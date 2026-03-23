import { createHmac, timingSafeEqual } from 'crypto'

export function verifyRazorpaySignature(
  body: string,
  signature: string,
  secret: string,
): boolean {
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

export function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
  toleranceSeconds = 300,
): boolean {
  const parts = sigHeader.split(',').reduce<Record<string, string>>((acc, part) => {
    const [k, v] = part.split('=')
    if (k && v) acc[k] = v
    return acc
  }, {})
  const timestamp = parseInt(parts['t'] ?? '0', 10)
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false
  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex')
  try {
    return timingSafeEqual(Buffer.from(parts['v1'] ?? ''), Buffer.from(expected))
  } catch {
    return false
  }
}

export function verifyPaypalSignature(
  webhookId: string,
  transmissionId: string,
  transmissionTime: string,
  body: string,
  actualSignature: string,
): boolean {
  const crc32 = (str: string): number => {
    const table = new Uint32Array(256).map((_, i) => {
      let c = i
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      return c
    })
    let crc = 0xffffffff
    for (const ch of Buffer.from(str)) crc = table[(crc ^ ch) & 0xff]! ^ (crc >>> 8)
    return (crc ^ 0xffffffff) >>> 0
  }
  const crc = crc32(body).toString(16)
  const message = [transmissionId, transmissionTime, webhookId, crc].join('|')
  const expected = createHmac('sha256', webhookId).update(message).digest('base64')
  try {
    return timingSafeEqual(Buffer.from(actualSignature), Buffer.from(expected))
  } catch {
    return false
  }
}
