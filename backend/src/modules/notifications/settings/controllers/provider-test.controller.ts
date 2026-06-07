import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { JwtGuard } from '../../../../core/auth/guards/jwt.guard';
import { RolesGuard } from '../../../../core/roles/roles.guard';
import { Roles } from '../../../../core/roles/roles.decorator';

import { CurrentUser } from '../../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../../core/auth/guards/jwt.strategy';

import { ProviderTestService } from '../services/provider-test.service';
import { TestProviderDto } from '../dto/test-provider.dto';

@ApiTags('notification-settings')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('notifications/settings')
export class ProviderTestController {
  constructor(
    private readonly providerTestService: ProviderTestService,
  ) {}

  @Post('test')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  testProvider(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TestProviderDto,
  ) {
    return this.providerTestService.testConnection(dto);
  }
}
