import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LibraryService }    from '../services/library.service';
import { CreateBookDto, IssueBookDto, ReturnBookDto } from '../dto/library.dto';
import { JwtGuard }          from '../../../core/auth/guards/jwt.guard';
import { RolesGuard }        from '../../../core/roles/roles.guard';
import { Roles }             from '../../../core/roles/roles.decorator';
import { CurrentUser }       from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../core/auth/guards/jwt.strategy';

@ApiTags('library')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('library')
export class LibraryController {
  constructor(private readonly svc: LibraryService) {}

  @Get('stats')
  stats(@CurrentUser() u: AuthenticatedUser) { return this.svc.stats(u.tenantId); }

  @Get('books')
  @ApiQuery({ name: 'search', required: false })
  listBooks(@CurrentUser() u: AuthenticatedUser, @Query('search') search?: string) {
    return this.svc.listBooks(u.tenantId, search);
  }

  @Post('books')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'LIBRARIAN')
  createBook(@Body() dto: CreateBookDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.createBook(u.tenantId, dto);
  }

  @Post('issue')
  @Roles('SCHOOL_ADMIN', 'LIBRARIAN')
  issue(@Body() dto: IssueBookDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.issueBook(u.tenantId, dto, u.id);
  }

  @Post('return/:issueId')
  @Roles('SCHOOL_ADMIN', 'LIBRARIAN')
  return(@Param('issueId') id: string, @Body() dto: ReturnBookDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.returnBook(u.tenantId, id, dto);
  }

  @Get('overdue')
  overdue(@CurrentUser() u: AuthenticatedUser) { return this.svc.overdueList(u.tenantId); }

  @Get('student/:studentId')
  studentHistory(@Param('studentId') sid: string, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.studentHistory(u.tenantId, sid);
  }
}
