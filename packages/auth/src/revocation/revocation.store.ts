export interface RevocationStore {
  revoke(userId: string, revokedAt: Date): Promise<void>
  isRevoked(userId: string, tokenIssuedAt: number): Promise<boolean>
  revokeSpecificJti(jti: string): Promise<void>
  isJtiRevoked(jti: string): Promise<boolean>
}

export class InMemoryRevocationStore implements RevocationStore {
  private userRevocations = new Map<string, Date>()
  private jtiSet = new Set<string>()

  async revoke(userId: string, revokedAt: Date) { this.userRevocations.set(userId, revokedAt) }
  async isRevoked(userId: string, tokenIssuedAt: number): Promise<boolean> {
    const rev = this.userRevocations.get(userId)
    return rev ? tokenIssuedAt < rev.getTime() / 1000 : false
  }
  async revokeSpecificJti(jti: string) { this.jtiSet.add(jti) }
  async isJtiRevoked(jti: string): Promise<boolean> { return this.jtiSet.has(jti) }
}
