import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LibraryService } from '../services/library.service';
import { CreateBookDto, CreateBookCopyDto, IssueBookDto, ReturnBookDto } from '../dto/library.dto';
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
  constructor(private readonly svc: LibraryService) {}

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
}
