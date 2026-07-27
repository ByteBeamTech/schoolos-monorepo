// ADR-LIB-001 §6 -- InventoryAudit is a stocktake: a header plus one line
// item per copy expected at the branch when the audit started, so a copy
// that's never scanned is still a visible "missing" discrepancy rather than
// silently absent from the record.

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { BookCopyStatus } from '@prisma/client';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../core/compliance/audit.service';
import { AuthenticatedUser } from '../../../core/auth/guards/jwt.strategy';
import { LibraryService } from './library.service';
import { BookCopyService } from './book-copy.service';
import { ScanAuditItemDto } from '../dto/library.dto';

@Injectable()
export class InventoryAuditService {
  constructor(
    private readonly prisma:          PrismaService,
    private readonly audit:           AuditService,
    private readonly libraryService:  LibraryService,
    private readonly bookCopyService: BookCopyService,
  ) {}

  async startAudit(tenantId: string, actor: AuthenticatedUser) {
    const branchId = this.libraryService.requireActingBranch(actor);

    return this.prisma.$transaction(async (tx: any) => {
      const audit = await tx.inventoryAudit.create({
        data: { tenantId, branchId, conductedBy: actor.id },
      });

      // DISPOSED copies are excluded -- they're no longer expected to be
      // anywhere, so they can never be a "missing" discrepancy.
      const copies = await tx.bookCopy.findMany({
        where:  { tenantId, branchId, status: { not: 'DISPOSED' } },
        select: { id: true, status: true },
      });

      if (copies.length > 0) {
        await tx.inventoryAuditItem.createMany({
          data: copies.map((c: any) => ({ auditId: audit.id, copyId: c.id, expectedStatus: c.status })),
        });
      }

      await this.audit.logCreate(
        {
          tenantId, actorId: actor.id, actorRole: actor.role,
          entityType: 'InventoryAudit', entityId: audit.id,
          after: { branchId, expectedItemCount: copies.length },
        },
        tx,
      );

      return audit;
    });
  }

  /**
   * ADR-LIB-001 §12 -- accepts one or many scanned items in a single call
   * (bulk/inventory scanning). Each entry is resolved independently by
   * barcode or copyId; a copy scanned that wasn't in the audit's original
   * snapshot (added to the branch after the audit started) gets its
   * expectedStatus captured from its current status at scan time, same as
   * the snapshot would have.
   */
  async scan(tenantId: string, auditId: string, entries: ScanAuditItemDto[], actor: AuthenticatedUser) {
    const audit = await this.prisma.inventoryAudit.findFirst({ where: { id: auditId, tenantId } });
    if (!audit) throw new NotFoundException('Inventory audit not found.');
    if (audit.status !== 'IN_PROGRESS') {
      throw new BadRequestException(`This audit is not in progress (status: ${audit.status}).`);
    }
    this.libraryService.assertSameBranch(actor, audit.branchId);

    const results: any[] = [];
    for (const entry of entries) {
      if (!entry.copyId && !entry.barcode) {
        results.push({ error: 'Either barcode or copyId is required.' });
        continue;
      }

      const copy = entry.copyId
        ? await this.prisma.bookCopy.findFirst({ where: { id: entry.copyId, tenantId, branchId: audit.branchId } })
        : await this.prisma.bookCopy.findFirst({ where: { tenantId, branchId: audit.branchId, barcode: entry.barcode } });

      if (!copy) {
        results.push({ ...entry, error: 'No copy with that barcode/id at this audit\u2019s branch.' });
        continue;
      }

      const existingItem = await this.prisma.inventoryAuditItem.findUnique({
        where: { auditId_copyId: { auditId, copyId: copy.id } },
      });
      const expectedStatus: BookCopyStatus = existingItem?.expectedStatus ?? copy.status;
      const discrepancy = entry.scannedStatus !== expectedStatus;

      const item = await this.prisma.inventoryAuditItem.upsert({
        where:  { auditId_copyId: { auditId, copyId: copy.id } },
        create: { auditId, copyId: copy.id, expectedStatus, scannedStatus: entry.scannedStatus, scannedAt: new Date(), discrepancy },
        update: { scannedStatus: entry.scannedStatus, scannedAt: new Date(), discrepancy },
      });
      results.push(item);
    }

    return results;
  }

  async complete(tenantId: string, auditId: string, actor: AuthenticatedUser) {
    const audit = await this.prisma.inventoryAudit.findFirst({ where: { id: auditId, tenantId } });
    if (!audit) throw new NotFoundException('Inventory audit not found.');
    if (audit.status !== 'IN_PROGRESS') {
      throw new BadRequestException(`This audit is not in progress (status: ${audit.status}).`);
    }
    this.libraryService.assertSameBranch(actor, audit.branchId);

    // A snapshot item never scanned at all is a discrepancy too -- ADR §6's
    // "missing" case, distinct from a scanned-but-wrong-status discrepancy.
    await this.prisma.inventoryAuditItem.updateMany({
      where: { auditId, scannedStatus: null },
      data:  { discrepancy: true },
    });

    const updated = await this.prisma.inventoryAudit.update({
      where: { id: auditId },
      data:  { status: 'COMPLETED', completedAt: new Date() },
    });

    await this.audit.logUpdate({
      tenantId, actorId: actor.id, actorRole: actor.role,
      entityType: 'InventoryAudit', entityId: auditId,
      before: { status: 'IN_PROGRESS' }, after: { status: 'COMPLETED' },
    });

    return updated;
  }

  async getAudit(tenantId: string, auditId: string) {
    const audit = await this.prisma.inventoryAudit.findFirst({
      where:   { id: auditId, tenantId },
      include: { items: { include: { copy: { include: { book: { select: { title: true, isbn: true } } } } } } },
    });
    if (!audit) throw new NotFoundException('Inventory audit not found.');
    return audit;
  }

  async listAudits(tenantId: string, branchId?: string) {
    return this.prisma.inventoryAudit.findMany({
      where:   { tenantId, ...(branchId ? { branchId } : {}) },
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * ADR-LIB-001 §6: "write-offs and recoveries require a role above the
   * actor who flagged them." The approval itself is enforced by the
   * controller's @Roles() gate (SCHOOL_ADMIN/PRINCIPAL, not LIBRARIAN) --
   * this function performs the already-approved transition, reusing the
   * same legal-transition-checked gate every other status change goes
   * through, so a reconciliation can't bypass the ADR §7 state machine.
   */
  async resolveDiscrepancy(tenantId: string, auditId: string, itemId: string, toStatus: BookCopyStatus, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx: any) => {
      const audit = await tx.inventoryAudit.findFirst({ where: { id: auditId, tenantId } });
      if (!audit) throw new NotFoundException('Inventory audit not found.');
      this.libraryService.assertSameBranch(actor, audit.branchId);

      const item = await tx.inventoryAuditItem.findFirst({ where: { id: itemId, auditId } });
      if (!item) throw new NotFoundException('Audit item not found.');
      if (!item.discrepancy) throw new BadRequestException('This item has no discrepancy to resolve.');

      await this.bookCopyService.transitionCopyStatus(tx, {
        tenantId, copyId: item.copyId, toStatus,
        actorId: actor.id, actorRole: actor.role,
        reason: `Inventory audit ${auditId} discrepancy resolution`,
      });

      return tx.inventoryAuditItem.update({ where: { id: item.id }, data: { resolvedAt: new Date() } });
    });
  }
}
