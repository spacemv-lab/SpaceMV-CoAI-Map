/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import React, { useState, useRef, useEffect } from 'react'

export type DropdownMenuProps = {
  trigger: React.ReactNode
  children: React.ReactNode
}

export function DropdownMenu(props: DropdownMenuProps) {
  const { trigger, children } = props
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  return (
    <div className="relative inline-block" ref={ref}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div
          className="absolute right-0 mt-2 min-w-[160px] rounded border bg-white shadow-md dark:bg-neutral-800"
          style={{ borderColor: 'var(--ai-border)' }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
