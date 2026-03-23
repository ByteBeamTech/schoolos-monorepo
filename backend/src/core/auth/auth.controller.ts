import {
  Controller, Post, Get, Body, Req,
  HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiResponse,
} from '@nestjs/swagger';
import { Request } from 'express';

import { AuthService }       from './auth.service';
import { JwtGuard }          from './guards/jwt.guard';
import { Public }            from './decorators/public.decorator';
import { CurrentUser }       from './decorators/current-user.decorator';
import { AuthenticatedUser } from './guards/jwt.strategy';
import { LoginDto, RefreshTokenDto, AuthResponseDto } from './dto/auth.dto';

@ApiTags('auth')
@UseGuards(JwtGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthResponseDto> {
    return this.auth.login(dto, req.tenantId, this.getIp(req), this.getUa(req));
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<Omit<AuthResponseDto, 'user'>> {
    return this.auth.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout — invalidates refresh token' })
  async logout(
    @Body() dto: RefreshTokenDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    return this.auth.logout(dto.refreshToken, user.id, user.tenantId, this.getIp(req), this.getUa(req));
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current authenticated user' })
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  private getIp(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket?.remoteAddress
      || 'unknown';
  }

  private getUa(req: Request): string {
    return req.headers['user-agent'] || 'unknown';
  }
}
