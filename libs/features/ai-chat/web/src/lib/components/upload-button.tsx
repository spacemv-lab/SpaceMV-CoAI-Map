/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import React, { useRef } from 'react'

export type UploadButtonProps = {
  accept?: string
  multiple?: boolean
  disabled?: boolean
  onUpload?: (files: File[]) => void
}

export function UploadButton(props: UploadButtonProps) {
  const { accept, multiple = true, disabled, onUpload } = props
  const inputRef = useRef<HTMLInputElement | null>(null)
  const onPick = () => {
    inputRef.current?.click()
  }
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    if (!files.length) return
    onUpload && onUpload(files)
    e.target.value = ''
  }
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
        className="hidden"
      />
      <button
        className="h-9 w-9 inline-flex items-center justify-center rounded border hover:bg-black/5 dark:hover:bg-white/5"
        style={{ borderColor: 'var(--ai-border)' }}
        disabled={disabled}
        onClick={onPick}
        title="上传文件"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor">
          <path d="M12 3v12" />
          <path d="M8 7l4-4 4 4" />
          <path d="M4 15v4h16v-4" />
        </svg>
      </button>
    </>
  )
}
