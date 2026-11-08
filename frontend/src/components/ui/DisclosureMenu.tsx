import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function DisclosureMenu({ label, children, className }: {
  label: ReactNode
  children: ReactNode
  className?: string
}) {
  const menuRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    const dismissOutside = (event: PointerEvent) => {
      const menu = menuRef.current
      if (menu?.open && !event.composedPath().includes(menu)) menu.open = false
    }
    document.addEventListener('pointerdown', dismissOutside)
    return () => document.removeEventListener('pointerdown', dismissOutside)
  }, [])

  const dismiss = () => {
    const menu = menuRef.current
    if (!menu?.open) return
    const restoreFocus = menu.contains(document.activeElement)
    menu.open = false
    if (restoreFocus) menu.querySelector('summary')?.focus()
  }

  return (
    <details
      className={cn('roster-menu', className)}
      ref={menuRef}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !event.currentTarget.open) return
        event.preventDefault()
        event.stopPropagation()
        dismiss()
      }}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false
      }}
    >
      <summary className="roster-button">{label}<ChevronDown size={14} aria-hidden="true" /></summary>
      <div className="roster-menu-panel" onClick={(event) => {
        if (event.target instanceof Element && event.target.closest('button:not(:disabled)')) dismiss()
      }}>{children}</div>
    </details>
  )
}
