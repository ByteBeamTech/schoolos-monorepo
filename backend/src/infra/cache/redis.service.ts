import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  public readonly client: Redis;

  constructor(private readonly config: ConfigService) {
    this.client = new Redis(this.config.get<string>('REDIS_URL', 'redis://localhost:6379'), {
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
      db: this.config.get<number>('REDIS_DB', 0),
      retryStrategy: (times) => Math.min(times * 100, 3000),
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.client.on('error', (err) => this.logger.error('Redis error:', err.message));
    this.client.on('reconnecting', () => this.logger.warn('Redis reconnecting...'));
  }

  async onModuleInit() {
    await this.client.connect();
    this.logger.log('Redis connected');
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('Redis disconnected');
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    try { return JSON.parse(value) as T; } catch { return null; }
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  tenantKey(tenantId: string, ...parts: string[]): string {
    return `tenant:${tenantId}:${parts.join(':')}`;
  }

  featureFlagKey(tenantId: string): string {
    return this.tenantKey(tenantId, 'feature-flags');
  }

  sessionKey(userId: string, sessionId: string): string {
    return `session:${userId}:${sessionId}`;
  }

  refreshTokenKey(token: string): string {
    return `refresh_token:${token}`;
  }

  async isHealthy(): Promise<boolean> {
    try { return (await this.client.ping()) === 'PONG'; }
    catch { return false; }
  }
}
