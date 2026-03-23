import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsEmail, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtGuard }          from '../auth/guards/jwt.guard';
import { RolesGuard }        from '../roles/roles.guard';
import { Roles }             from '../roles/roles.decorator';
import { CurrentUser }       from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt.strategy';

const VALID_ROLES = [
  'TEACHER','CLASS_TEACHER','PRINCIPAL','ACCOUNTANT',
  'LIBRARIAN','NURSE','STAFF','SCHOOL_ADMIN','PARENT','STUDENT',
] as const;

export class CreateUserApiDto {
  @ApiProperty() @IsEmail()      @IsNotEmpty() email!:      string;
  @ApiProperty() @IsString()     @IsNotEmpty() firstName!:  string;
  @ApiProperty() @IsString()     @IsNotEmpty() lastName!:   string;
  @ApiProperty({ enum: VALID_ROLES })
  @IsEnum(VALID_ROLES)           @IsNotEmpty() role!:       string;
  @ApiPropertyOptional() @IsString() @IsOptional() phone?:    string;
  @ApiPropertyOptional() @IsString() @IsOptional() password?: string;
}

@ApiTags('users')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Post()
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Create a user account (for staff onboarding)' })
  async create(
    @Body() dto: CreateUserApiDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create({
      tenantId:  user.tenantId,
      email:     dto.email,
      password:  dto.password ?? 'School@123',
      firstName: dto.firstName,
      lastName:  dto.lastName,
      role:      dto.role,
      phone:     dto.phone,
    });
  }

  @Get()
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'List all users for the tenant' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service['prisma'].user.findMany({
      where:   { tenantId: user.tenantId, deletedAt: null },
      select:  { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
      orderBy: { firstName: 'asc' },
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findByIdOrThrow(user.tenantId, id);
  }
}
