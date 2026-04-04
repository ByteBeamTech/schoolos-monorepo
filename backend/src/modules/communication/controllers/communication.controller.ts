import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards }  from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CommunicationService } from '../services/communication.service';
import { CreateAnnouncementDto, CreateCircularDto } from '../dto/communication.dto';
import { JwtGuard }          from '../../../core/auth/guards/jwt.guard';
import { RolesGuard }        from '../../../core/roles/roles.guard';
import { Roles }             from '../../../core/roles/roles.decorator';
import { CurrentUser }       from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../core/auth/guards/jwt.strategy';

@ApiTags('communication')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('communication')
export class CommunicationController {
  constructor(private readonly svc: CommunicationService) {}

  @Get('stats')                   stats(@CurrentUser() u: AuthenticatedUser) { return this.svc.stats(u.tenantId); }
  @Get('announcements')           list(@CurrentUser()  u: AuthenticatedUser) { return this.svc.listAnnouncements(u.tenantId); }
  @Get('circulars')               listCirc(@CurrentUser() u: AuthenticatedUser) { return this.svc.listCirculars(u.tenantId); }

  @Post('announcements')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  createAnn(@Body() dto: CreateAnnouncementDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.createAnnouncement(u.tenantId, dto, u.id);
  }

  @Patch('announcements/:id/pin')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  pin(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.pinAnnouncement(u.tenantId, id);
  }

  @Delete('announcements/:id')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  deleteAnn(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.deleteAnnouncement(u.tenantId, id);
  }

  @Post('circulars')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  createCirc(@Body() dto: CreateCircularDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.createCircular(u.tenantId, dto, u.id);
  }
}
