import { 
  Controller, 
  Post, 
  Body, 
  Req, 
  Get, 
  UseGuards, 
  HttpCode,
  UnauthorizedException, 
  HttpStatus 
} from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { JwtGuard } from './guards/jwt.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './guards/jwt.strategy';
import { LoginDto, RefreshTokenDto, AuthResponseDto } from './dto/auth.dto';

/**
 * एक्सप्रेस Request में tenantId इंजेक्ट करने के लिए टाइप एक्सटेंशन।
 * ये TypeScript एरर 'Property tenantId does not exist on type Request' को रोकेगा।
 */
interface RequestWithTenant extends Request {
  tenantId: string;
}

@ApiTags('auth')
@Controller('auth')
@UseGuards(JwtGuard)
export class AuthController {
  constructor(
	  private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })


async login(
  @Body() dto: LoginDto,
  @Req() req: RequestWithTenant
): Promise<AuthResponseDto> {

  const tenantId =
    req.tenantId ||
    (req.headers['x-tenant-id'] as string);

  if (!tenantId) {
    throw new UnauthorizedException(
      'Tenant header missing',
    );
  }

  return this.auth.login(
    dto,
    tenantId,
    this.getIp(req),
    this.getUa(req),
  );
}


  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
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
    @Req() req: RequestWithTenant,
  ): Promise<void> {
    return this.auth.logout(
      dto.refreshToken, 
      user.id, 
      user.tenantId, 
      this.getIp(req), 
      this.getUa(req)
    );
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current authenticated user' })
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  // --- Password Reset Endpoints (Bug 7 Fix) ---

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Request a password reset OTP via email' })
  async forgotPassword(
    @Body() body: { email: string },
    @Req() req: RequestWithTenant,
  ): Promise<{ message: string }> {
    await this.passwordReset.requestReset(req.tenantId, body.email);
    // सिक्योरिटी के लिए हमेशा यही रिस्पॉन्स दें ताकि ईमेल पता न चले
    return { message: 'If an account exists, a reset code has been sent.' };
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Reset password using OTP from email' })
  async resetPassword(
    @Body() body: { email: string; otp: string; newPassword: string },
    @Req() req: RequestWithTenant,
  ) {
    return this.passwordReset.resetPassword(
      req.tenantId, 
      body.email, 
      body.otp, 
      body.newPassword
    );
  }

  // --- Utility Methods ---

  private getIp(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket?.remoteAddress
      || 'unknown';
  }

  private getUa(req: Request): string {
    return req.headers['user-agent'] || 'unknown';
  }
}
