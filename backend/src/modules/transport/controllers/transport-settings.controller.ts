import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TransportSettingsService } from '../services/transport-settings.service';
import { UpdateTransportSettingsDto } from '../dto/transport-settings.dto';
import { JwtGuard } from '../../../core/auth/guards/jwt.guard';
import { RolesGuard } from '../../../core/roles/roles.guard';
import { Roles } from '../../../core/roles/roles.decorator';
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../core/auth/guards/jwt.strategy';

// AF-002 Transport Settings. Roles mirror SAD Ch.10 actors with authority
// over transport configuration (Branch Admin / Transport Manager); School
// Owner and Super Admin retain tenant-wide override access.
const TRANSPORT_SETTINGS_ROLES = [
  'SUPER_ADMIN',
  'SCHOOL_OWNER',
  'SCHOOL_ADMIN',
  'PRINCIPAL',
  'TRANSPORT_MANAGER',
];

@ApiTags('transport-settings')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('transport/branches/:branchId/settings')
export class TransportSettingsController {
  constructor(private readonly svc: TransportSettingsService) {}

  @Get()
  @Roles(...TRANSPORT_SETTINGS_ROLES)
  get(@Param('branchId') branchId: string, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.getOrCreate(u.tenantId, branchId, u);
  }

  @Patch()
  @Roles(...TRANSPORT_SETTINGS_ROLES)
  update(
    @Param('branchId') branchId: string,
    @Body() dto: UpdateTransportSettingsDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.svc.update(u.tenantId, branchId, dto, u);
  }
}
