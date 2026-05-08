import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),
  SUPERADMIN_URL: z.string().url(),
  API_PREFIX: z.string().default('api/v1'),
  DATABASE_URL: z.string().url(),
  // Connection pool — tune for your server RAM (12GB = 10–15 connections safe)
  DATABASE_POOL_SIZE:    z.coerce.number().default(10),
  DATABASE_POOL_TIMEOUT: z.coerce.number().default(30),
  DATABASE_SHADOW_URL: z.string().url().optional(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().default('15m'),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_EXPIRY: z.string().default('7d'),
  RAZORPAY_STUDENT_KEY_ID: z.string().optional(),
  RAZORPAY_STUDENT_KEY_SECRET: z.string().optional(),
  RAZORPAY_STUDENT_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_SAAS_KEY_ID: z.string().optional(),
  RAZORPAY_SAAS_KEY_SECRET: z.string().optional(),
  RAZORPAY_SAAS_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_STUDENT_SECRET_KEY: z.string().optional(),
  STRIPE_STUDENT_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_SAAS_SECRET_KEY: z.string().optional(),
  STRIPE_SAAS_WEBHOOK_SECRET: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  CORS_ORIGINS: z.string().default('http://localhost:4000,http://localhost:3001'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${errors}`);
  }
  return result.data;
}
