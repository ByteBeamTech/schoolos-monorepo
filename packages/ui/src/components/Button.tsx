import React from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export function Button({ variant = 'primary', size = 'md', loading, children, disabled, ...props }: ButtonProps) {
  return (
    <button {...props} disabled={disabled || loading}>
      {loading ? '...' : children}
    </button>
  )
}
