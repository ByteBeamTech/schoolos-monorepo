import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import * as bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

export interface CreateUserDto {
  tenantId:  string;
  email:     string;
  password:  string;
  firstName: string;
  lastName:  string;
  role:      string;
  phone?:    string;
}

export interface SafeUser {
  id:              string;
  tenantId:        string;
  email:           string;
  phone:           string | null;
  firstName:       string;
  lastName:        string;
  role:            string;
  isActive:        boolean;
  isEmailVerified: boolean;
  avatarUrl:       string | null;
  lastLoginAt:     Date | null;
  createdAt:       Date;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findById(tenantId: string, id: string): Promise<SafeUser | null> {
    const user = await this.prisma.user.findFirst({
      where:  { id, tenantId, deletedAt: null },
      select: this.safeSelect(),
    });
    return user as SafeUser | null;
  }

  async findByIdOrThrow(tenantId: string, id: string): Promise<SafeUser> {
    const user = await this.findById(tenantId, id);
    if (!user) throw new NotFoundException(`User not found: ${id}`);
    return user;
  }

  async findByEmail(tenantId: string, email: string): Promise<SafeUser | null> {
    const user = await this.prisma.user.findFirst({
      where:  { tenantId, email: email.toLowerCase().trim(), deletedAt: null },
      select: this.safeSelect(),
    });
    return user as SafeUser | null;
  }

  async findByEmailWithPassword(
    tenantId: string,
    email:    string,
  ): Promise<(SafeUser & { passwordHash: string | null }) | null> {
    const user = await this.prisma.user.findFirst({
      where:  { tenantId, email: email.toLowerCase().trim(), deletedAt: null },
      select: { ...this.safeSelect(), passwordHash: true },
    });
    return user as (SafeUser & { passwordHash: string | null }) | null;
  }

  async create(dto: CreateUserDto): Promise<SafeUser> {
    const existing = await this.findByEmail(dto.tenantId, dto.email);
    if (existing) {
      throw new ConflictException(
        `User with email ${dto.email} already exists in this tenant.`,
      );
    }

    const passwordHash = await this.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        tenantId:        dto.tenantId,
        email:           dto.email.toLowerCase().trim(),
        passwordHash,
        firstName:       dto.firstName,
        lastName:        dto.lastName,
        role:            dto.role as any,
        phone:           dto.phone ?? null,
        isActive:        true,
        isEmailVerified: false,
      },
      select: this.safeSelect(),
    });

    this.logger.log(`User created: ${user.email} in tenant ${dto.tenantId}`);
    return user as SafeUser;
  }

  // BUG 7 FIX: Always pass explicit tenantId + id in the where clause.
  // The $use CLS middleware injects tenantId automatically on request-scoped
  // calls, but updateLastLogin is also called from auth flows where auth/(.*)
  // is excluded from TenantMiddleware, meaning CLS may be empty.
  // Explicit tenantId here makes this safe in ALL contexts.
  async updateLastLogin(userId: string, tenantId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId, tenantId },
      data:  { lastLoginAt: new Date() },
    });
  }

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  }

  async validatePassword(plain: string, hash: string): Promise<boolean> {
    if (!hash) return false;
    return bcrypt.compare(plain, hash);
  }

  async updatePassword(userId: string, tenantId: string, newPassword: string): Promise<void> {
    const hash = await this.hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: userId, tenantId },  // explicit tenantId here too
      data:  { passwordHash: hash },
    });
  }

  private safeSelect() {
    return {
      id:              true,
      tenantId:        true,
      email:           true,
      phone:           true,
      firstName:       true,
      lastName:        true,
      role:            true,
      isActive:        true,
      isEmailVerified: true,
      avatarUrl:       true,
      lastLoginAt:     true,
      createdAt:       true,
    };
  }
}
