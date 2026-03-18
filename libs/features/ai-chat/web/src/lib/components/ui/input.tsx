/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import React from 'react'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export function Input(props: InputProps) {
  const { className, ...rest } = props
  return (
    <input
      {...rest}
      className={['rounded border px-3 h-9 text-sm outline-none', className].filter(Boolean).join(' ')}
      style={{ borderColor: 'var(--ai-border)', backgroundColor: 'var(--ai-panel)' }}
    />
  )
}
