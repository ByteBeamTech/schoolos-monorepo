import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService }    from './auth.service';
import { UsersService }   from '../users/users.service';
import { TokenService }   from '../identity/token.service';
import { AuditService }   from '../compliance/audit.service';
import { PrismaService }  from '@infra/database/prisma.service';

// PR-2.5 (test infra cleanup): AuthService.login() resolves the tenant via
// prisma.tenant.findFirst({ where: { OR: [{ id }, { slug }] } }) before
// anything else -- see auth.service.ts. Without this mock, every test module
// fails to compile ("Nest can't resolve dependencies"). Echoes back whichever
// id/slug was queried so it works across every describe block below, which
// each use different tenantId fixtures ('tenant-1' vs 't1').
const mockPrismaService = {
  tenant: {
    findFirst: jest.fn().mockImplementation(({ where }: any) => {
      const id = where?.OR?.[0]?.id ?? where?.OR?.[1]?.slug;
      return Promise.resolve(id ? { id } : null);
    }),
  },
};

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
        {
          provide: PrismaService,
          useValue: mockPrismaService,
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


// ============================================================================
// Phase 1 v3 — extended coverage (appended — do not delete this marker)
// ============================================================================

describe("AuthService — redirectPath by role", () => {
  const mockTokenPair = {
    accessToken: "t", refreshToken: "r",
    accessTokenExpiresIn: 900, refreshTokenExpiresIn: 604800,
  };

  async function buildWithRole(role: string) {
    const user = {
      id: "u1", tenantId: "t1", email: "x@y.com",
      firstName: "X", lastName: "Y", role,
      isActive: true, avatarUrl: null,
      passwordHash: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4tbAn.hAO2",
    };
    const m = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: { findByEmailWithPassword: jest.fn().mockResolvedValue(user), validatePassword: jest.fn().mockResolvedValue(true), updateLastLogin: jest.fn() } },
        { provide: TokenService,  useValue: { issueTokens: jest.fn().mockResolvedValue(mockTokenPair) } },
        { provide: AuditService,  useValue: { log: jest.fn() } },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();
    return m.get<AuthService>(AuthService);
  }

  it.each([
    ["SCHOOL_ADMIN",  "/dashboard"],
    ["ACCOUNTANT",    "/dashboard/billing"],
    ["TEACHER",       "/dashboard/academics"],
    ["CLASS_TEACHER", "/dashboard/attendance"],
    ["PARENT",        "/parent"],
    ["STUDENT",       "/student"],
    ["UNKNOWN_ROLE",  "/dashboard"],
  ])("role %s → redirectPath %s", async (role, expected) => {
    const svc = await buildWithRole(role);
    const res = await svc.login({ email: "x@y.com", password: "p" }, "t1", "", "");
    expect(res.redirectPath).toBe(expected);
  });
});

describe("AuthService — security edge cases", () => {
  it("returns identical error message for ghost email vs wrong password (prevents email enumeration)", async () => {
    const m = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: { findByEmailWithPassword: jest.fn().mockResolvedValue(null), validatePassword: jest.fn(), updateLastLogin: jest.fn() } },
        { provide: TokenService,  useValue: { issueTokens: jest.fn() } },
        { provide: AuditService,  useValue: { log: jest.fn() } },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();
    const svc = m.get<AuthService>(AuthService);
    let msg = "";
    await svc.login({ email: "ghost@y.com", password: "p" }, "t1", "", "").catch(e => { msg = e.message; });
    expect(msg).toBe("Invalid email or password.");
  });

  it("throws with SSO-specific message when passwordHash is null", async () => {
    const ssoUser = { id: "u1", tenantId: "t1", email: "x@y.com", firstName: "X", lastName: "Y", role: "TEACHER", isActive: true, avatarUrl: null, passwordHash: null };
    const m = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: { findByEmailWithPassword: jest.fn().mockResolvedValue(ssoUser), validatePassword: jest.fn(), updateLastLogin: jest.fn() } },
        { provide: TokenService,  useValue: { issueTokens: jest.fn() } },
        { provide: AuditService,  useValue: { log: jest.fn() } },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();
    const svc = m.get<AuthService>(AuthService);
    await expect(svc.login({ email: "x@y.com", password: "p" }, "t1", "", ""))
      .rejects.toThrow("Password login is not enabled");
  });
});
