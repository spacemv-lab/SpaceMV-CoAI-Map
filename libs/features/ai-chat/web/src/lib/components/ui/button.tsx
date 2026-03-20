/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import React from 'react'

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'md'
}

export function Button(props: ButtonProps) {
  const { variant = 'default', size = 'md', className, ...rest } = props
  const base = 'inline-flex items-center justify-center rounded transition-colors'
  const sizes = size === 'sm' ? 'h-8 px-2 text-xs' : 'h-9 px-3 text-sm'
  const variants =
    variant === 'outline'
      ? 'border bg-transparent'
      : variant === 'ghost'
      ? 'bg-transparent'
      : 'bg-black/10 dark:bg-white/10'
  return <button {...rest} className={[base, sizes, variants, className].filter(Boolean).join(' ')} />
}
