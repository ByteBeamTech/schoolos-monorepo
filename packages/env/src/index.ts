import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),

  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid PostgreSQL URL' }),
  REDIS_URL:    z.string().url({ message: 'REDIS_URL must be a valid Redis URL' }),

  JWT_SECRET:            z.string().min(32, { message: 'JWT_SECRET must be at least 32 characters' }),
  JWT_EXPIRY:            z.string().default('15m'),
  REFRESH_TOKEN_EXPIRY:  z.string().default('7d'),
  SUPERADMIN_JWT_SECRET: z.string().min(32, { message: 'SUPERADMIN_JWT_SECRET must be at least 32 characters' }),

  RAZORPAY_STUDENT_KEY_ID:         z.string().min(1),
  RAZORPAY_STUDENT_KEY_SECRET:     z.string().min(1),
  RAZORPAY_STUDENT_WEBHOOK_SECRET: z.string().min(1),
  RAZORPAY_SAAS_KEY_ID:            z.string().min(1),
  RAZORPAY_SAAS_KEY_SECRET:        z.string().min(1),
  RAZORPAY_SAAS_WEBHOOK_SECRET:    z.string().min(1),

  STRIPE_STUDENT_SECRET_KEY:       z.string().min(1),
  STRIPE_STUDENT_WEBHOOK_SECRET:   z.string().min(1),
  STRIPE_SAAS_SECRET_KEY:          z.string().min(1),
  STRIPE_SAAS_WEBHOOK_SECRET:      z.string().min(1),

  AWS_ACCESS_KEY_ID:      z.string().min(1),
  AWS_SECRET_ACCESS_KEY:  z.string().min(1),
  AWS_S3_BUCKET_PROD:     z.string().default('schoolos-prod'),
  AWS_S3_BUCKET_BACKUPS:  z.string().default('schoolos-backups'),
  AWS_REGION:             z.string().default('ap-south-1'),

  OPENAI_API_KEY: z.string().min(1),

  SENDGRID_API_KEY:    z.string().optional(),
  TWILIO_ACCOUNT_SID:  z.string().optional(),
  TWILIO_AUTH_TOKEN:   z.string().optional(),
  FCM_SERVER_KEY:      z.string().optional(),

  PORT:            z.coerce.number().default(3000),
  SUPERADMIN_PORT: z.coerce.number().default(3001),
})

export type Env = z.infer<typeof envSchema>

let _env: Env | undefined

export function validateEnv(): Env {
  if (_env) return _env

  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('\n[SchoolOS] Environment validation failed. Fix these before starting:\n')
    result.error.issues.forEach(issue => {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
    })
    console.error('\nSee configs/env/.env.example for reference.\n')
    process.exit(1)
  }

  _env = result.data
  return _env
}

export function getEnv(): Env {
  if (!_env) throw new Error('Call validateEnv() before getEnv()')
  return _env
}
