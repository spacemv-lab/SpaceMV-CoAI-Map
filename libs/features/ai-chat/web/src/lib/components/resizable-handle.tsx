/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import React from 'react'

export type ResizableHandleProps = {
  onPointerDown?: (e: React.PointerEvent) => void
}

export function ResizableHandle(props: ResizableHandleProps) {
  const { onPointerDown } = props
  return (
    <div
      onPointerDown={onPointerDown}
      className="w-1 cursor-col-resize h-full"
      style={{ backgroundColor: 'var(--ai-border)' }}
    />
  )
}
