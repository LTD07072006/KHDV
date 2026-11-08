import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type ButtonVariant = 'primary' | 'secondary'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
}

export function Button({ className, variant = 'secondary', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn('roster-button', variant === 'primary' && 'roster-primary', className)} {...props} />
}
