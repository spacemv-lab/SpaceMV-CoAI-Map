/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import React, { useState } from 'react'

export type VoiceButtonProps = {
  disabled?: boolean
  onStart?: () => void
  onStop?: () => void
}

export function VoiceButton(props: VoiceButtonProps) {
  const { disabled, onStart, onStop } = props
  const [active, setActive] = useState(false)
  const toggle = () => {
    if (disabled) return
    if (active) {
      onStop && onStop()
      setActive(false)
    } else {
      onStart && onStart()
      setActive(true)
    }
  }
  return (
    <button
      className="h-9 w-9 inline-flex items-center justify-center rounded border hover:bg-black/5 dark:hover:bg-white/5"
      style={{ borderColor: 'var(--ai-border)', color: active ? 'var(--ai-primary)' : undefined }}
      disabled={disabled}
      onClick={toggle}
      title={active ? '停止语音' : '开始语音'}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor">
        <rect x="9" y="3" width="6" height="10" rx="3" />
        <path d="M5 10a7 7 0 0 0 14 0" />
        <path d="M12 17v4" />
      </svg>
    </button>
  )
}
