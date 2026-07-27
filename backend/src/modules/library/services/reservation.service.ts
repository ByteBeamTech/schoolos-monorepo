// ADR-LIB-001 §8 -- Reservation is a claim on (Book, branch), not on a
// specific BookCopy. This service owns the whole lifecycle: queueing,
// allocation (both the synchronous "a copy is already free right now"
// path and the event-driven "a copy just became free" path), cancellation,
// and hold expiry.

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@infra/database/prisma.service';
import { AuthenticatedUser } from '../../../core/auth/guards/jwt.strategy';
import { BorrowerResolverService } from './borrower-resolver.service';
import { BookCopyService } from './book-copy.service';
import { LibraryService } from './library.service';
import { EVENTS } from '../../../core/events/events.constants';
import { ReserveBookDto } from '../dto/library.dto';

/** Prisma Client's error code for a unique constraint violation. */
const PRISMA_UNIQUE_VIOLATION = 'P2002';

@Injectable()
export class ReservationService {
  private readonly logger = new Logger(ReservationService.name);

  constructor(
    private readonly prisma:           PrismaService,
    private readonly borrowerResolver: BorrowerResolverService,
    private readonly bookCopyService:  BookCopyService,
    private readonly libraryService:   LibraryService,
  ) {}

  async reserve(tenantId: string, dto: ReserveBookDto, actor: AuthenticatedUser) {
    const branchId = this.libraryService.requireActingBranch(actor);
    const borrower = await this.borrowerResolver.resolve(tenantId, dto.borrowerType, dto.borrowerId);
    if (!borrower.isActive) {
      throw new BadRequestException('This borrower is not active and cannot place a reservation.');
    }

    const book = await this.prisma.book.findFirst({ where: { id: dto.bookId, tenantId } });
    if (!book) throw new NotFoundException('Book not found.');

    let reservation: any;
    try {
      reservation = await this.prisma.reservation.create({
        data: {
          tenantId, branchId, bookId: dto.bookId,
          borrowerType: dto.borrowerType, borrowerId: dto.borrowerId,
          borrowerNameSnapshot: borrower.displayName,
        },
      });
    } catch (err: any) {
      if (err?.code === PRISMA_UNIQUE_VIOLATION && String(err?.meta?.target ?? '').includes('Reservation')) {
        throw new BadRequestException('This borrower already has an active reservation for this book at this branch.');
      }
      throw err;
    }

    // ADR §8's event-driven allocation only fires on a FUTURE "copy became
    // available" event -- if a copy is already sitting AVAILABLE right now
    // (nobody was ahead in the queue to have already claimed it), no such
    // event is coming until someone returns a copy. Attempting allocation
    // immediately after queueing closes that gap; it's the same function
    // the event listener below calls, so this is not a second code path.
    const allocated = await this.attemptAllocation(tenantId, branchId, dto.bookId, actor.id);
    return allocated && allocated.id === reservation.id ? allocated : reservation;
  }

  /**
   * The step nothing else in this service performs: converting a
   * READY_FOR_PICKUP reservation into an actual issued loan when the
   * borrower shows up to collect it. Without this, a copy could reach
   * RESERVED_HOLD and then have no legal path forward -- issueBook()
   * only ever transitions AVAILABLE copies (deliberately, so a librarian
   * can't accidentally hand a held copy to a walk-in borrower instead of
   * the person it's reserved for), so fulfillment needs its own
   * RESERVED_HOLD -> ISSUED path, scoped to the reservation's own
   * borrower.
   */
  async fulfill(tenantId: string, reservationId: string, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx: any) => {
      const r = await tx.reservation.findFirst({ where: { id: reservationId, tenantId } });
      if (!r) throw new NotFoundException('Reservation not found.');
      if (r.status !== 'READY_FOR_PICKUP' || !r.copyId) {
        throw new BadRequestException(`Only a READY_FOR_PICKUP reservation can be fulfilled (current status: ${r.status}).`);
      }
      this.libraryService.assertSameBranch(actor, r.branchId);

      const borrower = await this.borrowerResolver.resolve(tenantId, r.borrowerType, r.borrowerId);
      if (!borrower.isActive) {
        throw new BadRequestException('This borrower is not active and cannot check out this reservation.');
      }

      const settings = await this.libraryService.getOrDefaultSettings(tx, tenantId, r.branchId);
      const activeCount = await tx.bookIssue.count({
        where: { tenantId, borrowerType: r.borrowerType, borrowerId: r.borrowerId, status: 'ISSUED' },
      });
      if (activeCount >= settings.maxActiveLoansPerBorrower) {
        throw new BadRequestException(
          `This borrower already has the maximum of ${settings.maxActiveLoansPerBorrower} active loan(s).`,
        );
      }

      await this.bookCopyService.transitionCopyStatus(tx, {
        tenantId, copyId: r.copyId, toStatus: 'ISSUED',
        actorId: actor.id, actorRole: actor.role, reason: `Reservation ${r.id} fulfilled`,
      });

      const dueDate = new Date(Date.now() + Number(settings.loanDurationDays) * 24 * 60 * 60 * 1000);
      const issue = await tx.bookIssue.create({
        data: {
          tenantId, branchId: r.branchId, copyId: r.copyId,
          borrowerType: r.borrowerType, borrowerId: r.borrowerId,
          borrowerNameSnapshot:      borrower.displayName,
          borrowerBranchIdSnapshot:  borrower.branchId,
          borrowerDisplayIdSnapshot: borrower.displayId,
          dueDate, issuedBy: actor.id,
        },
      });

      const updatedReservation = await tx.reservation.update({
        where: { id: r.id },
        data:  { status: 'FULFILLED', fulfilledAt: new Date() },
      });

      return { reservation: updatedReservation, issue };
    });
  }

  async cancel(tenantId: string, reservationId: string, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx: any) => {
      const r = await tx.reservation.findFirst({ where: { id: reservationId, tenantId } });
      if (!r) throw new NotFoundException('Reservation not found.');
      if (r.status !== 'QUEUED' && r.status !== 'READY_FOR_PICKUP') {
        throw new BadRequestException(`Only a QUEUED or READY_FOR_PICKUP reservation can be cancelled (current status: ${r.status}).`);
      }
      this.libraryService.assertSameBranch(actor, r.branchId);

      if (r.copyId) {
        // Releases the hold and -- since transitionCopyStatus emits
        // LIBRARY_COPY_AVAILABLE on any transition into AVAILABLE -- this
        // alone is enough to eventually reach the next person in the
        // queue, even without the explicit call below.
        await this.bookCopyService.transitionCopyStatus(tx, {
          tenantId, copyId: r.copyId, toStatus: 'AVAILABLE',
          actorId: actor.id, actorRole: actor.role, reason: 'Reservation cancelled',
        });
      }

      return tx.reservation.update({
        where: { id: r.id },
        data:  { status: 'CANCELLED', cancelledAt: new Date() },
      });
    });
  }

  async listForBook(tenantId: string, bookId: string, branchId?: string) {
    return this.prisma.reservation.findMany({
      where:   { tenantId, bookId, ...(branchId ? { branchId } : {}) },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listForBorrower(tenantId: string, borrowerType: 'STUDENT' | 'STAFF', borrowerId: string) {
    return this.prisma.reservation.findMany({
      where:   { tenantId, borrowerType, borrowerId },
      include: { book: { select: { title: true, isbn: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * The allocation algorithm, and the ONLY place it lives -- called both
   * synchronously (reserve(), cancel() indirectly via the copy-available
   * event) and asynchronously (onCopyAvailable() below, via OutboxWorker).
   * Idempotent / safe to call speculatively: no-ops cleanly if there's no
   * queued reservation or no available copy.
   */
  async attemptAllocation(tenantId: string, branchId: string, bookId: string, actorId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      // Locked on (tenantId, branchId, bookId) -- not a specific copyId --
      // because this operation's real unit of contention is "the next
      // available copy of this book at this branch," matching how the
      // reservation queue itself is scoped (ADR §8).
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock($1)`,
        this.bookCopyService.lockKeyForBookAvailability(tenantId, branchId, bookId),
      );

      const nextReservation = await tx.reservation.findFirst({
        where:   { tenantId, branchId, bookId, status: 'QUEUED' },
        orderBy: { createdAt: 'asc' },
      });
      if (!nextReservation) return null;

      const availableCopy = await tx.bookCopy.findFirst({
        where:   { tenantId, branchId, bookId, status: 'AVAILABLE' },
        orderBy: { createdAt: 'asc' },
      });
      if (!availableCopy) return null;

      await this.bookCopyService.transitionCopyStatus(tx, {
        tenantId, copyId: availableCopy.id, toStatus: 'RESERVED_HOLD',
        actorId, reason: `Allocated to reservation ${nextReservation.id}`,
      });

      const settings = await this.libraryService.getOrDefaultSettings(tx, tenantId, branchId);
      const holdExpiresAt = new Date(Date.now() + Number(settings.reservationHoldHours) * 60 * 60 * 1000);

      const updated = await tx.reservation.update({
        where: { id: nextReservation.id },
        data:  { status: 'READY_FOR_PICKUP', copyId: availableCopy.id, holdExpiresAt },
      });

      await tx.eventOutbox.create({
        data: {
          uniqueKey: `library-reservation-ready:${updated.id}:${Date.now()}`,
          type:      EVENTS.LIBRARY_RESERVATION_READY,
          payload: {
            core: { tenantId },
            reservationId: updated.id, branchId, bookId,
            borrowerType: updated.borrowerType, borrowerId: updated.borrowerId,
            holdExpiresAt: updated.holdExpiresAt,
          },
        },
      });

      return updated;
    });
  }

  @OnEvent(EVENTS.LIBRARY_COPY_AVAILABLE)
  async onCopyAvailable(payload: { core: { tenantId: string }; branchId: string; bookId: string; copyId: string }) {
    try {
      await this.attemptAllocation(payload.core.tenantId, payload.branchId, payload.bookId, 'system:library-copy-available');
    } catch (err) {
      // Not swallowed: OutboxWorker's retry/backoff re-delivers this event
      // on a thrown rejection (see subscription-activated.listener.ts for
      // the same convention in this codebase) -- a failed allocation
      // attempt should be retried, not silently dropped.
      this.logger.error(
        `Reservation allocation failed for book=${payload.bookId} branch=${payload.branchId}: ` +
        `${err instanceof Error ? err.message : err}`,
      );
      throw err;
    }
  }

  /**
   * ADR §8: hold expiry is "a scheduled job (or lazy check on next
   * relevant read)" -- implemented as a scheduled job, consistent with
   * this codebase's existing OutboxWorker convention (@Cron on a plain
   * injectable provider, no extra module wiring needed since
   * ScheduleModule is already registered globally).
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async expireHolds() {
    const now = new Date();
    const expired = await this.prisma.reservation.findMany({
      where:  { status: 'READY_FOR_PICKUP', holdExpiresAt: { lt: now } },
      select: { id: true, tenantId: true, branchId: true, bookId: true },
    });
    if (expired.length === 0) return;

    for (const r of expired) {
      try {
        await this.prisma.$transaction(async (tx: any) => {
          // Re-read inside the transaction: it may have been picked up
          // (fulfilled via issueBook, not yet wired to Reservation until a
          // future phase) or cancelled between the read above and now.
          const fresh = await tx.reservation.findFirst({ where: { id: r.id, status: 'READY_FOR_PICKUP' } });
          if (!fresh) return;

          if (fresh.copyId) {
            await this.bookCopyService.transitionCopyStatus(tx, {
              tenantId: fresh.tenantId, copyId: fresh.copyId, toStatus: 'AVAILABLE',
              actorId: 'system:hold-expiry', reason: 'Reservation hold expired',
            });
          }
          await tx.reservation.update({ where: { id: fresh.id }, data: { status: 'EXPIRED' } });
        });

        // Give the next person in line a chance at the copy this expiry
        // just freed up -- the transitionCopyStatus call above already
        // queued a LIBRARY_COPY_AVAILABLE event for this (picked up within
        // OutboxWorker's ~5s poll interval), so this is a latency
        // optimization, not a correctness requirement.
        await this.attemptAllocation(r.tenantId, r.branchId, r.bookId, 'system:hold-expiry');
      } catch (err) {
        this.logger.error(
          `Failed to expire reservation hold ${r.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }
}
