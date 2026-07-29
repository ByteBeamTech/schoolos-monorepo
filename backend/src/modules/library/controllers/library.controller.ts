import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LibraryService } from '../services/library.service';
import { ReservationService } from '../services/reservation.service';
import { InventoryAuditService } from '../services/inventory-audit.service';
import { LibraryChargeRequestService } from '../services/charge-request.service';
import {
  CreateBookDto, CreateBookCopyDto, IssueBookDto, ReturnBookDto,
  ReserveBookDto, BulkScanAuditDto, ResolveAuditItemDto,
} from '../dto/library.dto';
import { JwtGuard } from '../../../core/auth/guards/jwt.guard';
import { RolesGuard } from '../../../core/roles/roles.guard';
import { Roles } from '../../../core/roles/roles.decorator';
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../core/auth/guards/jwt.strategy';

@ApiTags('library')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('library')
export class LibraryController {
  constructor(
    private readonly svc:           LibraryService,
    private readonly reservations:  ReservationService,
    private readonly audits:        InventoryAuditService,
    private readonly chargeRequests: LibraryChargeRequestService,
  ) {}

  @Get('stats')
  stats(@CurrentUser() u: AuthenticatedUser) {
    return this.svc.stats(u.tenantId);
  }

  @Get('books')
  @ApiQuery({ name: 'search', required: false })
  listBooks(@CurrentUser() u: AuthenticatedUser, @Query('search') search?: string) {
    return this.svc.listBooks(u.tenantId, search);
  }

  @Post('books')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'LIBRARIAN')
  createBook(@Body() dto: CreateBookDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.createBook(u.tenantId, dto, u);
  }

  @Post('books/:bookId/copies')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'LIBRARIAN')
  addBookCopy(
    @Param('bookId') bookId: string,
    @Body() dto: CreateBookCopyDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.svc.addBookCopy(u.tenantId, { ...dto, bookId }, u);
  }

  @Post('issue')
  @Roles('SCHOOL_ADMIN', 'LIBRARIAN')
  issue(@Body() dto: IssueBookDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.issueBook(u.tenantId, dto, u);
  }

  @Post('return/:issueId')
  @Roles('SCHOOL_ADMIN', 'LIBRARIAN')
  return(
    @Param('issueId') id: string,
    @Body() dto: ReturnBookDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.svc.returnBook(u.tenantId, id, dto, u);
  }

  @Post('issues/:issueId/lost')
  @Roles('SCHOOL_ADMIN', 'LIBRARIAN')
  markLost(@Param('issueId') id: string, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.markLost(u.tenantId, id, u);
  }

  @Post('issues/:issueId/renew')
  @Roles('SCHOOL_ADMIN', 'LIBRARIAN')
  renew(@Param('issueId') id: string, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.renewBook(u.tenantId, id, u);
  }

  @Get('overdue')
  overdue(@CurrentUser() u: AuthenticatedUser) {
    return this.svc.overdueList(u.tenantId, u.branchId);
  }

  // Kept at its original path for backward compatibility -- treated as
  // borrowerType=STUDENT. See LibraryService.borrowerHistory() for the
  // IDOR note (fix deferred to Phase 6, not this phase).
  @Get('student/:studentId')
  studentHistory(@Param('studentId') studentId: string, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.borrowerHistory(u.tenantId, 'STUDENT', studentId);
  }

  @Get('borrower/:borrowerType/:borrowerId')
  borrowerHistory(
    @Param('borrowerType') borrowerType: 'STUDENT' | 'STAFF',
    @Param('borrowerId') borrowerId: string,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.svc.borrowerHistory(u.tenantId, borrowerType, borrowerId);
  }

  @Get('issues')
  @ApiQuery({ name: 'status', required: false })
  listIssues(
    @CurrentUser() u: AuthenticatedUser,
    @Query('status') status?: string,
  ) {
    return this.svc.listIssues(u.tenantId, status, u.branchId);
  }

  // ------------------------------------------------------------------
  // Reservations (ADR-LIB-001 §8)
  // ------------------------------------------------------------------
  // Staff-mediated for now (LIBRARIAN/SCHOOL_ADMIN place a reservation on
  // a borrower's behalf) -- self-service Student/Parent Portal reservation
  // is explicit Phase 6 scope (ADR §14), not this phase.

  @Post('reservations')
  @Roles('SCHOOL_ADMIN', 'LIBRARIAN')
  reserve(@Body() dto: ReserveBookDto, @CurrentUser() u: AuthenticatedUser) {
    return this.reservations.reserve(u.tenantId, dto, u);
  }

  @Post('reservations/:reservationId/cancel')
  @Roles('SCHOOL_ADMIN', 'LIBRARIAN')
  cancelReservation(@Param('reservationId') id: string, @CurrentUser() u: AuthenticatedUser) {
    return this.reservations.cancel(u.tenantId, id, u);
  }

  @Post('reservations/:reservationId/fulfill')
  @Roles('SCHOOL_ADMIN', 'LIBRARIAN')
  fulfillReservation(@Param('reservationId') id: string, @CurrentUser() u: AuthenticatedUser) {
    return this.reservations.fulfill(u.tenantId, id, u);
  }

  @Get('reservations')
  @ApiQuery({ name: 'status', required: false })
  listReservations(@CurrentUser() u: AuthenticatedUser, @Query('status') status?: string) {
    return this.reservations.listAll(u.tenantId, u.branchId, status);
  }

  @Get('reservations/book/:bookId')
  reservationsForBook(@Param('bookId') bookId: string, @CurrentUser() u: AuthenticatedUser) {
    return this.reservations.listForBook(u.tenantId, bookId, u.branchId);
  }

  @Get('reservations/borrower/:borrowerType/:borrowerId')
  reservationsForBorrower(
    @Param('borrowerType') borrowerType: 'STUDENT' | 'STAFF',
    @Param('borrowerId') borrowerId: string,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.reservations.listForBorrower(u.tenantId, borrowerType, borrowerId);
  }

  // ------------------------------------------------------------------
  // Inventory Audits (ADR-LIB-001 §6)
  // ------------------------------------------------------------------

  @Post('inventory-audits')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'LIBRARIAN')
  startAudit(@CurrentUser() u: AuthenticatedUser) {
    return this.audits.startAudit(u.tenantId, u);
  }

  @Get('inventory-audits')
  listAudits(@CurrentUser() u: AuthenticatedUser) {
    return this.audits.listAudits(u.tenantId, u.branchId);
  }

  @Get('inventory-audits/:auditId')
  getAudit(@Param('auditId') id: string, @CurrentUser() u: AuthenticatedUser) {
    return this.audits.getAudit(u.tenantId, id);
  }

  @Post('inventory-audits/:auditId/scan')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'LIBRARIAN')
  scanAudit(
    @Param('auditId') id: string,
    @Body() dto: BulkScanAuditDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.audits.scan(u.tenantId, id, dto.items, u);
  }

  @Post('inventory-audits/:auditId/complete')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'LIBRARIAN')
  completeAudit(@Param('auditId') id: string, @CurrentUser() u: AuthenticatedUser) {
    return this.audits.complete(u.tenantId, id, u);
  }

  // ADR §6: write-offs/recoveries require a role ABOVE the LIBRARIAN who
  // flagged them during scanning -- deliberately excluded from this
  // endpoint's @Roles(), unlike start/scan/complete above.
  @Post('inventory-audits/:auditId/items/:itemId/resolve')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  resolveAuditItem(
    @Param('auditId') auditId: string,
    @Param('itemId') itemId: string,
    @Body() dto: ResolveAuditItemDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.audits.resolveDiscrepancy(u.tenantId, auditId, itemId, dto.toStatus, u);
  }

  // ------------------------------------------------------------------
  // Charge Requests (ADR-LIB-001 §9) -- Library proposes, Billing owns
  // the money. No amountPaid/receipt/refund/ledger endpoint exists here
  // and never will; that is all Student Billing's surface, reached only
  // via the LIBRARY_CHARGE_REQUESTED event once sent.
  // ------------------------------------------------------------------

  @Get('charge-requests')
  @ApiQuery({ name: 'billingStatus', required: false })
  listChargeRequests(
    @CurrentUser() u: AuthenticatedUser,
    @Query('billingStatus') billingStatus?: string,
  ) {
    return this.chargeRequests.list(u.tenantId, { branchId: u.branchId, billingStatus });
  }

  @Get('charge-requests/borrower/:borrowerType/:borrowerId')
  chargeRequestsForBorrower(
    @Param('borrowerType') borrowerType: 'STUDENT' | 'STAFF',
    @Param('borrowerId') borrowerId: string,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.chargeRequests.listForBorrower(u.tenantId, borrowerType, borrowerId);
  }

  @Post('charge-requests/:chargeRequestId/send-to-billing')
  @Roles('SCHOOL_ADMIN', 'LIBRARIAN')
  sendChargeRequestToBilling(@Param('chargeRequestId') id: string, @CurrentUser() u: AuthenticatedUser) {
    return this.chargeRequests.sendToBilling(u.tenantId, id, u);
  }

  @Post('charge-requests/:chargeRequestId/waive')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  waiveChargeRequest(@Param('chargeRequestId') id: string, @CurrentUser() u: AuthenticatedUser) {
    return this.chargeRequests.waive(u.tenantId, id, u);
  }
}
