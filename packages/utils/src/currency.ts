export type CurrencyCode = 'INR' | 'USD' | 'GBP' | 'EUR'

export function formatCurrency(amountInPaise: number, currency: CurrencyCode): string {
  const amount = amountInPaise / 100
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount)
}

export function toSmallestUnit(amount: number): number {
  return Math.round(amount * 100)
}

export function fromSmallestUnit(amount: number): number {
  return amount / 100
}
