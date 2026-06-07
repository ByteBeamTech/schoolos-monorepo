import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';

import { JwtGuard }
from '../../../core/auth/guards/jwt.guard';

import { RolesGuard }
from '../../../core/roles/roles.guard';

import { Roles }
from '../../../core/roles/roles.decorator';

import { CurrentUser }
from '../../../core/auth/decorators/current-user.decorator';

import { AuthenticatedUser }
from '../../../core/auth/guards/jwt.strategy';

import { TemplateAdminService }
from './template-admin.service';

import { CreateTemplateDto }
from './dto/create-template.dto';

import { UpdateTemplateDto }
from './dto/update-template.dto';

@ApiTags('communication-templates')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('communication/templates')
export class TemplateAdminController {
  constructor(
    private readonly service: TemplateAdminService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.list(
      user.tenantId,
    );
  }

  @Post()
  @Roles('SCHOOL_ADMIN')
  create(
    @Body() dto: CreateTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(
      user.tenantId,
      dto,
    );
  }

  @Put(':id')
  @Roles('SCHOOL_ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(
      user.tenantId,
      id,
      dto,
    );
  }

  @Delete(':id')
  @Roles('SCHOOL_ADMIN')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(
      user.tenantId,
      id,
    );
  }
}
