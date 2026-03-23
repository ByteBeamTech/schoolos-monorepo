import { Controller, Get, Post, Body, Param, Query, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CertificatesService } from '../services/certificates.service';
import { IssueCertificateDto } from '../dto/certificates.dto';
import { JwtGuard }            from '../../../core/auth/guards/jwt.guard';
import { RolesGuard }          from '../../../core/roles/roles.guard';
import { Roles }               from '../../../core/roles/roles.decorator';
import { CurrentUser }         from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser }   from '../../../core/auth/guards/jwt.strategy';

@ApiTags('certificates')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('certificates')
export class CertificatesController {
  constructor(private readonly svc: CertificatesService) {}

  @Get()
  @ApiQuery({ name: 'studentId', required: false })
  list(@CurrentUser() u: AuthenticatedUser, @Query('studentId') sid?: string) {
    return this.svc.list(u.tenantId, sid);
  }

  @Post()
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  issue(@Body() dto: IssueCertificateDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.issue(u.tenantId, dto, u.id);
  }

  @Get(':id/print')
  async print(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Res() res: Response) {
    const all  = await this.svc.list(u.tenantId);
    const cert = all.find((c: any) => c.id === id);
    if (!cert) { res.status(404).send('Not found'); return; }
    res.setHeader('Content-Type', 'text/html');
    res.send(this.svc.generateHtml(cert));
  }
}
