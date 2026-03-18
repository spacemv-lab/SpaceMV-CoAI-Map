/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import React, { useState } from 'react';
import { UploadButton } from './upload-button';
import { VoiceButton } from './voice-button';

export type ChatInputProps = {
  placeholder?: string;
  disabled?: boolean;
  isStreaming?: boolean;
  presetText?: string;
  onSend?: (text: string) => void;
  onUploadFiles?: (files: File[]) => void;
  onVoiceStart?: () => void;
  onVoiceStop?: () => void;
  onStop?: () => void;
  onRegenerate?: () => void;
  className?: string;
};

export function ChatInput(props: ChatInputProps) {
  const {
    placeholder = '输入消息...',
    disabled,
    isStreaming,
    presetText,
    onSend,
    onUploadFiles,
    onVoiceStart,
    onVoiceStop,
    onStop,
    onRegenerate,
    className,
  } = props;
  const [text, setText] = useState('');
  const [optimisticStreaming, setOptimisticStreaming] = useState(false);
  React.useEffect(() => {
    if (typeof presetText === 'string') {
      setText(presetText);
    }
  }, [presetText]);
  React.useEffect(() => {
    if (!isStreaming) setOptimisticStreaming(false);
  }, [isStreaming]);
  const onSubmit = () => {
    const value = text.trim();
    if (!value || disabled) return;
    setOptimisticStreaming(true);
    onSend && onSend(value);
    setText('');
  };
  return (
    <div className={['px-4 py-3', className].filter(Boolean).join(' ')}>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full resize-y min-h-[64px] max-h-[200px] rounded-xl border px-3 py-2 text-sm outline-none bg-white/85 dark:bg-neutral-900/60 shadow-sm transition-colors focus:ring-2 focus:ring-primary/40 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            style={{ borderColor: 'var(--ai-border)' }}
          />
        </div>
        <div className="flex items-center gap-2">
          <VoiceButton
            onStart={onVoiceStart}
            onStop={onVoiceStop}
            disabled={disabled}
          />
          <button
            className="h-9 px-3 rounded-xl bg-primary text-primary-foreground text-sm shadow-sm transition-colors hover:bg-primary/90 active:bg-primary/95 disabled:opacity-50"
            disabled={disabled}
            onClick={
              isStreaming || optimisticStreaming
                ? () => {
                    setOptimisticStreaming(false);
                    onStop && onStop();
                  }
                : onSubmit
            }
          >
            {isStreaming || optimisticStreaming ? '停止' : '发送'}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <UploadButton onUpload={onUploadFiles} disabled={disabled} />
      </div>
    </div>
  );
}
