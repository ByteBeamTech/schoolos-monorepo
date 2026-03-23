export interface IdempotencyStore {
  has(key: string): Promise<boolean>
  set(key: string, ttlSeconds?: number): Promise<void>
}

export async function withIdempotency<T>(
  store: IdempotencyStore,
  key: string,
  handler: () => Promise<T>,
  ttlSeconds = 86400,
): Promise<{ result: T | null; skipped: boolean }> {
  if (await store.has(key)) {
    return { result: null, skipped: true }
  }
  const result = await handler()
  await store.set(key, ttlSeconds)
  return { result, skipped: false }
}
