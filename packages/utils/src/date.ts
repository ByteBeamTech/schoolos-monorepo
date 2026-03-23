export function daysUntil(date: Date): number {
  const now = new Date()
  const diff = date.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function daysSince(date: Date): number {
  return -daysUntil(date)
}

export function startOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function endOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

export function toIST(date: Date): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
}
