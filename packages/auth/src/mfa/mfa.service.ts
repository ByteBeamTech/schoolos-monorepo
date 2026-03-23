import * as speakeasy from 'speakeasy'
import * as QRCode from 'qrcode'
import { randomBytes } from 'crypto'

export interface MfaEnrollment {
  secret: string
  otpauthUrl: string
  qrCodeDataUrl: string
  backupCodes: string[]
}

export class MfaService {
  async enroll(userEmail: string, appName = 'SchoolOS'): Promise<MfaEnrollment> {
    const secret = speakeasy.generateSecret({
      name: `${appName} (${userEmail})`,
      length: 20,
    })
    const backupCodes = this.generateBackupCodes(8)
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url ?? '')
    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url ?? '',
      qrCodeDataUrl,
      backupCodes,
    }
  }

  verify(token: string, secret: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1,
    })
  }

  verifyBackupCode(
    inputCode: string,
    storedCodes: string[],
  ): { valid: boolean; remaining: string[] } {
    const idx = storedCodes.indexOf(inputCode.toUpperCase())
    if (idx === -1) return { valid: false, remaining: storedCodes }
    const remaining = [...storedCodes]
    remaining.splice(idx, 1)
    return { valid: true, remaining }
  }

  private generateBackupCodes(count: number): string[] {
    return Array.from({ length: count }, () => {
      const hex = randomBytes(4).toString('hex').toUpperCase()
      return `${hex.slice(0, 4)}-${hex.slice(4)}`
    })
  }
}
