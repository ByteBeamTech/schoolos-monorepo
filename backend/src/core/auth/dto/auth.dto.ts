import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@greenvalley.edu' })
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'SecurePass@123' })
  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token from previous login or refresh' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class AuthResponseDto {
  @ApiProperty() accessToken!:           string;
  @ApiProperty() refreshToken!:          string;
  @ApiProperty() accessTokenExpiresIn!:  number;
  @ApiProperty() refreshTokenExpiresIn!: number;
  @ApiProperty({ required: false }) redirectPath?: string;
  @ApiProperty() user!: {
    id:        string;
    email:     string;
    firstName: string;
    lastName:  string;
    role:      string;
    tenantId:  string;
    avatarUrl: string | null;
  };
}
