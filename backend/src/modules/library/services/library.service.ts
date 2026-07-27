import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../core/compliance/audit.service';
import { AuthenticatedUser } from '../../../core/auth/guards/jwt.strategy';
import { BorrowerResolverService } from './borrower-resolver.service';
import { BookCopyService } from './book-copy.service';
import { CreateBookDto, CreateBookCopyDto, IssueBookDto, ReturnBookDto } from '../dto/library.dto';

/** Prisma Client's error code for a unique constraint violation (wraps the underlying Postgres 23505 regardless of whether the index is one schema.prisma knows about — this partial index isn't). */
const PRISMA_UNIQUE_VIOLATION = 'P2002';

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma:           PrismaService,
    private readonly audit:            AuditService,
    private readonly borrowerResolver: BorrowerResolverService,
    private readonly bookCopyService:  BookCopyService,
  ) {}

  // ------------------------------------------------------------------
  // Branch context
  // ------------------------------------------------------------------

  /**
   * The branch every mutating Library action operates against. Deliberately
   * NOT re-derived or re-validated here: `actor.branchId` has already been
   * resolved and authorized by BranchContextMiddleware (from the `x-branch-id`
   * header the frontend's api-branch-interceptor sends automatically, or the
   * user's default branch) before this service ever runs -- re-implementing
   * that check here would be a second, weaker copy of AUTH-051/052/058's
   * logic (reuse existing infrastructure, per implementation rules). Library
   * mutations are inherently branch-specific physical actions, so unlike a
   * read/report endpoint, a missing branch context is a hard error here, not
   * a "show tenant-wide" fallback.
   */
  private requireActingBranch(actor: AuthenticatedUser): string {
    if (!actor.branchId) {
      throw new BadRequestException('Select a branch before performing this Library action.');
    }
    return actor.branchId;
  }

  /**
   * A BookIssue's branchId is a snapshot taken at issue time (ADR §5) --
   * returning/marking-lost is restricted to that same branch when the actor
   * has one selected, so an issue cannot be closed out from an unrelated
   * branch by accident. Tenant-wide actors (no branchId selected) are
   * unrestricted, consistent with BranchContextMiddleware's own tenant-wide
   * semantics.
   */
  private assertSameBranch(actor: AuthenticatedUser, issueBranchId: string) {
    if (actor.branchId && actor.branchId !== issueBranchId) {
      throw new ForbiddenException('This issue belongs to a different branch.');
    }
  }

  private async getOrDefaultSettings(tx: any, tenantId: string, branchId: string) {
    const existing = await tx.libraryBranchSettings.findFirst({ where: { tenantId, branchId } });
    if (existing) return existing;
    // ADR §1: "created on demand with defaults rather than provisioned
    // eagerly for every branch." Column defaults double as the in-memory
    // fallback so a first-ever issue at a new branch doesn't fail.
    return {
      loanDurationDays:          14,
      maxRenewals:               2,
      maxActiveLoansPerBorrower: 1,
      reservationHoldHours:      48,
      fineRatePerDay:            2.0,
    };
  }

  // ------------------------------------------------------------------
  // Catalog
  // ------------------------------------------------------------------

  async stats(tenantId: string) {
    const [totalBooks, totalCopies, availableCopies, issued, overdue] = await Promise.all([
      this.prisma.book.count({ where: { tenantId } }),
      this.prisma.bookCopy.count({ where: { tenantId } }),
      this.prisma.bookCopy.count({ where: { tenantId, status: 'AVAILABLE' } }),
      this.prisma.bookIssue.count({ where: { tenantId, status: 'ISSUED' } }),
      this.prisma.bookIssue.count({ where: { tenantId, status: 'ISSUED', dueDate: { lt: new Date() } } }),
    ]);
    return { totalBooks, totalCopies, availableCopies, issued, overdue };
  }

  async listBooks(tenantId: string, search?: string) {
    const books = await this.prisma.book.findMany({
      where:   { tenantId },
      include: {
        category:        { select: { id: true, name: true } },
        publisherRecord: { select: { id: true, name: true } },
        authors:         { include: { author: { select: { id: true, name: true } } } },
        _count:          { select: { copies: true } },
      },
      orderBy: { title: 'asc' },
    });

    // Single grouped query for availability, not one COUNT per book (avoids
    // the N+1 the pre-Phase-2 in-memory-filter version would have grown
    // into once availability moved off a stored counter).
    const availabilityRows = await this.prisma.bookCopy.groupBy({
      by:     ['bookId'],
      where:  { tenantId, status: 'AVAILABLE' },
      _count: { _all: true },
    });
    const availableByBook = new Map(availabilityRows.map((r) => [r.bookId, r._count._all]));

    const shaped = books.map((b) => ({
      ...b,
      authorNames:     b.authors.map((ba) => ba.author.name),
      totalCopies:     b._count.copies,
      availableCopies: availableByBook.get(b.id) ?? 0,
    }));

    // Search still filters in memory here -- ADR §10's SQL full-text/trigram
    // search is explicit Phase 5 scope; Phase 2 only had to keep this
    // endpoint working against the new schema, not fix its search strategy.
    if (!search) return shaped;
    const s = search.toLowerCase();
    return shaped.filter((b) =>
      b.title.toLowerCase().includes(s) ||
      (b.isbn ?? '').includes(s) ||
      b.authorNames.some((n) => n.toLowerCase().includes(s)) ||
      (b.category?.name ?? '').toLowerCase().includes(s),
    );
  }

  /**
   * Resolve-or-create an Author/Publisher/BookCategory row by free-text
   * name, for the legacy-shaped CreateBookDto convenience fields (ADR §1
   * taxonomy -- same "one row per distinct name" backfill rule the Phase 2
   * migration used for existing data).
   */
  private async resolveOrCreateByName(
    tx: any,
    model: 'author' | 'publisher' | 'bookCategory',
    tenantId: string,
    name: string,
  ): Promise<string> {
    const trimmed = name.trim();
    const existing = model === 'bookCategory'
      ? await tx.bookCategory.findFirst({ where: { tenantId, parentId: null, name: trimmed } })
      : await tx[model].findFirst({ where: { tenantId, name: trimmed } });
    if (existing) return existing.id;

    const created = model === 'bookCategory'
      ? await tx.bookCategory.create({ data: { tenantId, name: trimmed } })
      : await tx[model].create({ data: { tenantId, name: trimmed } });
    return created.id;
  }

  async createBook(tenantId: string, dto: CreateBookDto, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx: any) => {
      let categoryId  = dto.categoryId;
      let publisherId = dto.publisherId;
      let authorIds   = dto.authorIds ?? [];

      if (!categoryId && dto.categoryName?.trim()) {
        categoryId = await this.resolveOrCreateByName(tx, 'bookCategory', tenantId, dto.categoryName);
      }
      if (!publisherId && dto.publisherName?.trim()) {
        publisherId = await this.resolveOrCreateByName(tx, 'publisher', tenantId, dto.publisherName);
      }
      if (authorIds.length === 0 && dto.authorName?.trim()) {
        authorIds = [await this.resolveOrCreateByName(tx, 'author', tenantId, dto.authorName)];
      }

      const book = await tx.book.create({
        data: {
          tenantId,
          title:       dto.title,
          isbn:        dto.isbn,
          categoryId,
          publisherId,
          authors: authorIds.length
            ? { create: authorIds.map((authorId) => ({ authorId })) }
            : undefined,
        },
      });

      await this.audit.logCreate(
        { tenantId, actorId: actor.id, actorRole: actor.role, entityType: 'Book', entityId: book.id, after: { title: book.title, isbn: book.isbn } },
        tx,
      );

      if (dto.initialCopies && dto.initialCopies > 0) {
        const branchId = this.requireActingBranch(actor);
        for (let i = 0; i < dto.initialCopies; i++) {
          const barcode = await this.bookCopyService.generateBarcode(tx, tenantId, branchId);
          const copy = await tx.bookCopy.create({ data: { tenantId, branchId, bookId: book.id, barcode } });
          await this.audit.logCreate(
            { tenantId, actorId: actor.id, actorRole: actor.role, entityType: 'BookCopy', entityId: copy.id, after: { bookId: copy.bookId, branchId: copy.branchId, barcode: copy.barcode } },
            tx,
          );
        }
      }

      return book;
    });
  }

  async addBookCopy(tenantId: string, dto: CreateBookCopyDto, actor: AuthenticatedUser) {
    const branchId = this.requireActingBranch(actor);
    const book = await this.prisma.book.findFirst({ where: { id: dto.bookId, tenantId } });
    if (!book) throw new NotFoundException('Book not found.');

    return this.prisma.$transaction(async (tx: any) => {
      const barcode = dto.barcode?.trim() || await this.bookCopyService.generateBarcode(tx, tenantId, branchId);
      const copy = await tx.bookCopy.create({
        data: {
          tenantId, branchId, bookId: dto.bookId,
          barcode, rfidTag: dto.rfidTag, shelfId: dto.shelfId, condition: dto.condition,
        },
      });
      await this.audit.logCreate(
        { tenantId, actorId: actor.id, actorRole: actor.role, entityType: 'BookCopy', entityId: copy.id, after: { bookId: copy.bookId, branchId: copy.branchId, barcode: copy.barcode } },
        tx,
      );
      return copy;
    });
  }

  // ------------------------------------------------------------------
  // Issue / Return / Lost
  // ------------------------------------------------------------------

  async issueBook(tenantId: string, dto: IssueBookDto, actor: AuthenticatedUser) {
    const borrower = await this.borrowerResolver.resolve(tenantId, dto.borrowerType, dto.borrowerId);
    if (!borrower.isActive) {
      throw new BadRequestException('This borrower is not active and cannot be issued a book.');
    }

    try {
      return await this.prisma.$transaction(async (tx: any) => {
        let copy = dto.copyId
          ? await tx.bookCopy.findFirst({ where: { id: dto.copyId, tenantId } })
          : null;

        if (!copy && dto.copyId) {
          throw new NotFoundException('Book copy not found.');
        }

        if (!copy) {
          if (!dto.bookId) {
            throw new BadRequestException('Either copyId or bookId is required.');
          }
          const branchId = this.requireActingBranch(actor);
          copy = await tx.bookCopy.findFirst({
            where:   { tenantId, bookId: dto.bookId, branchId, status: 'AVAILABLE' },
            orderBy: { createdAt: 'asc' },
          });
          if (!copy) {
            throw new BadRequestException('No available copy of this book at your branch.');
          }
        } else {
          this.assertSameBranch(actor, copy.branchId);
        }

        // Advisory lock, then re-read: the orchestration-level safety net
        // (ADR §7 -- FEE-1's per-aggregate lock convention). The partial
        // unique index on BookIssue(copyId) WHERE status='ISSUED' is the
        // structural, DB-level backstop underneath this -- see the NOTE on
        // the BookCopy model.
        await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock($1)`, this.bookCopyService.lockKeyForCopy(copy.id));
        const freshCopy = await tx.bookCopy.findFirst({ where: { id: copy.id } });
        if (!freshCopy || freshCopy.status !== 'AVAILABLE') {
          throw new BadRequestException('This copy is no longer available.');
        }

        const settings = await this.getOrDefaultSettings(tx, tenantId, freshCopy.branchId);
        const activeCount = await tx.bookIssue.count({
          where: { tenantId, borrowerType: dto.borrowerType, borrowerId: dto.borrowerId, status: 'ISSUED' },
        });
        if (activeCount >= settings.maxActiveLoansPerBorrower) {
          throw new BadRequestException(
            `This borrower already has the maximum of ${settings.maxActiveLoansPerBorrower} active loan(s).`,
          );
        }

        await this.bookCopyService.transitionCopyStatus(tx, {
          tenantId, copyId: freshCopy.id, toStatus: 'ISSUED',
          actorId: actor.id, actorRole: actor.role, reason: 'Book issued',
        });

        const dueDate = dto.dueDate
          ? new Date(dto.dueDate)
          : new Date(Date.now() + Number(settings.loanDurationDays) * 24 * 60 * 60 * 1000);

        const issue = await tx.bookIssue.create({
          data: {
            tenantId,
            branchId:                  freshCopy.branchId,
            copyId:                    freshCopy.id,
            borrowerType:              dto.borrowerType,
            borrowerId:                dto.borrowerId,
            borrowerNameSnapshot:      borrower.displayName,
            borrowerBranchIdSnapshot:  borrower.branchId,
            borrowerDisplayIdSnapshot: borrower.displayId,
            dueDate,
            issuedBy: actor.id,
          },
          include: { copy: { include: { book: { select: { title: true, isbn: true } } } } },
        });

        await this.audit.logCreate(
          {
            tenantId, actorId: actor.id, actorRole: actor.role,
            entityType: 'BookIssue', entityId: issue.id,
            after: { copyId: issue.copyId, borrowerType: issue.borrowerType, borrowerId: issue.borrowerId, dueDate: issue.dueDate },
          },
          tx,
        );

        return issue;
      });
    } catch (err: any) {
      // Defense in depth: if the advisory lock were ever bypassed by a bug
      // elsewhere, the partial unique index (BookIssue_copyId_open_issue_key)
      // is the last line of defense -- surface it as a clean 400, not a raw
      // 500, per the ADR's "structural, not just lock-mitigated" intent.
      if (err?.code === PRISMA_UNIQUE_VIOLATION && String(err?.meta?.target ?? '').includes('copyId')) {
        throw new BadRequestException('This copy was just issued by someone else. Please try again.');
      }
      throw err;
    }
  }

  async returnBook(tenantId: string, issueId: string, dto: ReturnBookDto, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx: any) => {
      const issue = await tx.bookIssue.findFirst({ where: { id: issueId, tenantId } });
      if (!issue) throw new NotFoundException('Issue not found.');
      if (issue.status !== 'ISSUED') {
        throw new BadRequestException(`Only an ISSUED book can be returned (current status: ${issue.status}).`);
      }
      this.assertSameBranch(actor, issue.branchId);

      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock($1)`, this.bookCopyService.lockKeyForCopy(issue.copyId));
      const freshIssue = await tx.bookIssue.findFirst({ where: { id: issueId } });
      if (!freshIssue || freshIssue.status !== 'ISSUED') {
        throw new BadRequestException('This issue has already been closed.');
      }

      const wasOverdue = new Date() > new Date(freshIssue.dueDate);
      const toStatus = dto.damaged ? 'DAMAGED' : 'AVAILABLE';

      await this.bookCopyService.transitionCopyStatus(tx, {
        tenantId, copyId: freshIssue.copyId, toStatus,
        actorId: actor.id, actorRole: actor.role,
        reason: dto.damaged ? 'Returned damaged' : 'Book returned',
      });

      const updated = await tx.bookIssue.update({
        where: { id: issueId },
        data:  { status: 'RETURNED', returnedAt: new Date(), returnedBy: actor.id },
      });

      await this.audit.logUpdate(
        {
          tenantId, actorId: actor.id, actorRole: actor.role,
          entityType: 'BookIssue', entityId: issue.id,
          before: { status: freshIssue.status }, after: { status: updated.status, damaged: !!dto.damaged },
        },
        tx,
      );

      return { returned: true, wasOverdue, damaged: !!dto.damaged };
    });
  }

  async markLost(tenantId: string, issueId: string, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx: any) => {
      const issue = await tx.bookIssue.findFirst({ where: { id: issueId, tenantId } });
      if (!issue) throw new NotFoundException('Issue not found.');
      if (issue.status !== 'ISSUED') {
        throw new BadRequestException(`Only an ISSUED book can be marked lost (current status: ${issue.status}).`);
      }
      this.assertSameBranch(actor, issue.branchId);

      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock($1)`, this.bookCopyService.lockKeyForCopy(issue.copyId));

      await this.bookCopyService.transitionCopyStatus(tx, {
        tenantId, copyId: issue.copyId, toStatus: 'LOST',
        actorId: actor.id, actorRole: actor.role, reason: 'Reported lost',
      });

      const updated = await tx.bookIssue.update({
        where: { id: issueId },
        data:  { status: 'LOST', returnedAt: new Date(), returnedBy: actor.id },
      });

      await this.audit.logUpdate(
        {
          tenantId, actorId: actor.id, actorRole: actor.role,
          entityType: 'BookIssue', entityId: issue.id,
          before: { status: issue.status }, after: { status: updated.status },
        },
        tx,
      );

      return updated;
    });
  }

  // ------------------------------------------------------------------
  // Reads
  // ------------------------------------------------------------------

  async overdueList(tenantId: string, branchId?: string) {
    return this.prisma.bookIssue.findMany({
      where:   { tenantId, ...(branchId ? { branchId } : {}), status: 'ISSUED', dueDate: { lt: new Date() } },
      include: { copy: { include: { book: { select: { title: true, isbn: true } } } } },
      orderBy: { dueDate: 'asc' },
    });
  }

  /**
   * NOTE: this endpoint has no ownership check -- any authenticated user in
   * the tenant can query any borrower's history (the audit's R3/S1 IDOR
   * finding). Fixing that is explicit Phase 6 scope (reuses the
   * StudentBillingAccessService-style guardian-ownership pattern, per ADR
   * §14) and is deliberately NOT done here -- see IMPLEMENTATION_STATE.md.
   * Only adapted to the new borrowerType/borrowerId/copy->book shape so it
   * keeps working at all.
   */
  async borrowerHistory(tenantId: string, borrowerType: 'STUDENT' | 'STAFF', borrowerId: string) {
    if (borrowerType !== 'STUDENT' && borrowerType !== 'STAFF') {
      throw new BadRequestException(`Unsupported borrower type: ${borrowerType}`);
    }
    return this.prisma.bookIssue.findMany({
      where:   { tenantId, borrowerType, borrowerId },
      include: { copy: { include: { book: { select: { title: true, isbn: true } } } } },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async listIssues(tenantId: string, status?: string, branchId?: string) {
    const where: any = { tenantId };
    if (status)   where.status   = status;
    if (branchId) where.branchId = branchId;
    return this.prisma.bookIssue.findMany({
      where,
      include: { copy: { include: { book: { select: { title: true, isbn: true } } } } },
      orderBy: { issuedAt: 'desc' },
      take: 200,
    });
  }
}
