# Secret Rotation Guide

## Secrets that MUST be rotated immediately

Run this to generate new secrets (requires openssl):

```bash
echo "JWT_SECRET=$(openssl rand -base64 48)"
echo "REFRESH_TOKEN_SECRET=$(openssl rand -base64 48)"
echo "SUPERADMIN_JWT_SECRET=$(openssl rand -base64 48)"
```

## For production: use a secret manager
- **Doppler** (recommended for teams): `doppler setup`
- **GitHub Actions**: Settings → Secrets → Actions
- **AWS Secrets Manager**: `aws secretsmanager create-secret`
- **Railway / Render**: Environment variables UI

## Never commit .env again
The .gitignore has been updated. Use .env.example to document
required variables (no real values). Each developer copies it:
  cp .env.example .env

## Payment gateway keys to rotate
- RAZORPAY_STUDENT_KEY_SECRET
- RAZORPAY_SAAS_KEY_SECRET
- STRIPE_STUDENT_SECRET_KEY
- STRIPE_SAAS_SECRET_KEY
- SENDGRID_API_KEY
- TWILIO_AUTH_TOKEN
