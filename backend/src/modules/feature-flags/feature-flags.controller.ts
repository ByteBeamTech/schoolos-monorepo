import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtGuard }   from '../../core/auth/guards/jwt.guard';
import { RolesGuard } from '../../core/roles/roles.guard';
import { Roles }      from '../../core/roles/roles.decorator';
import { ALL_FLAGS }  from '../../core/feature-flags/flag-definitions';

@ApiTags('feature-flags')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('feature-flags')
export class FeatureFlagsController {
  @Get('definitions')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get all flag definitions' })
  getDefinitions() { return ALL_FLAGS; }
}
