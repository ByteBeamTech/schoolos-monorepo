import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService }    from './auth.service';
import { UsersService }   from '../users/users.service';
import { TokenService }   from '../identity/token.service';
import { AuditService }   from '../compliance/audit.service';

const mockUser = {
  id: 'user-1', tenantId: 'tenant-1', email: 'admin@school.com',
  firstName: 'Admin', lastName: 'User', role: 'SCHOOL_ADMIN',
  isActive: true, avatarUrl: null,
  passwordHash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4tbAn.hAO2',
};

const mockTokenPair = {
  accessToken: 'mock-access', refreshToken: 'mock-refresh',
  accessTokenExpiresIn: 900, refreshTokenExpiresIn: 604800,
};

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let tokenService: jest.Mocked<TokenService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmailWithPassword: jest.fn(),
            validatePassword:        jest.fn(),
            updateLastLogin:         jest.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: {
            issueTokens:         jest.fn().mockResolvedValue(mockTokenPair),
            rotateRefreshToken:  jest.fn(),
            revokeRefreshToken:  jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: { log: jest.fn(), logCreate: jest.fn() },
        },
      ],
    }).compile();

    service      = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    tokenService = module.get(TokenService);
  });

  // TEST 1
  it('should return tokens + user on valid login', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue(mockUser as any);
    usersService.validatePassword.mockResolvedValue(true);

    const result = await service.login(
      { email: 'admin@school.com', password: 'correct' },
      'tenant-1', '127.0.0.1', 'jest',
    );

    expect(result.accessToken).toBe('mock-access');
    expect(result.user.email).toBe('admin@school.com');
    expect(tokenService.issueTokens).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', tenantId: 'tenant-1' }),
    );
  });

  // TEST 2
  it('should throw UnauthorizedException on wrong password', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue(mockUser as any);
    usersService.validatePassword.mockResolvedValue(false);

    await expect(
      service.login({ email: 'admin@school.com', password: 'wrong' }, 'tenant-1', '', ''),
    ).rejects.toThrow(UnauthorizedException);
  });

  // TEST 3
  it('should throw UnauthorizedException for unknown email', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue(null);

    await expect(
      service.login({ email: 'unknown@school.com', password: 'any' }, 'tenant-1', '', ''),
    ).rejects.toThrow(UnauthorizedException);
  });

  // TEST 4
  it('should throw UnauthorizedException for inactive user', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue(
      { ...mockUser, isActive: false } as any,
    );

    await expect(
      service.login({ email: 'admin@school.com', password: 'any' }, 'tenant-1', '', ''),
    ).rejects.toThrow(UnauthorizedException);
  });

  // TEST 5
  it('should call revokeRefreshToken on logout', async () => {
    tokenService.revokeRefreshToken.mockResolvedValue(undefined);
    await service.logout('mock-refresh', 'user-1', 'tenant-1', '', '');
    expect(tokenService.revokeRefreshToken).toHaveBeenCalledWith('mock-refresh');
  });
});
