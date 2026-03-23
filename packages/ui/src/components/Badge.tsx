import React from 'react'

export interface BadgeProps {
  variant?: 'info' | 'success' | 'warning' | 'danger' | 'neutral'
  children: React.ReactNode
}

export function Badge({ variant = 'neutral', children }: BadgeProps) {
  return <span data-variant={variant}>{children}</span>
}
