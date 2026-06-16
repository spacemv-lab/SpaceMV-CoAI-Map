/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { ChangeEvent, useState, useEffect } from 'react';

interface ColorControlProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

export function ColorControl({ value, onChange, label = '颜色' }: ColorControlProps) {
  const [previewColor, setPreviewColor] = useState(value);
  const [isSelecting, setIsSelecting] = useState(false);

  // Sync previewColor when prop value changes (e.g. from store)
  useEffect(() => {
    setPreviewColor(value);
  }, [value]);

  const handleColorChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPreviewColor(e.target.value);
  };

  const handleConfirm = () => {
    onChange(previewColor);
    setIsSelecting(false);
  };

  const handleCancel = () => {
    setPreviewColor(value);
    setIsSelecting(false);
  };

  return (
    <div className="flex items-center justify-between">
      <label className="text-sm text-gray-600">{label}</label>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-gray-500 w-16 text-center">
          {previewColor || '#cccccc'}
        </span>
        <div className="relative w-6 h-6 rounded overflow-hidden border border-gray-200 shadow-sm">
          <input
            type="color"
            value={previewColor || '#cccccc'}
            onChange={handleColorChange}
            onFocus={() => setIsSelecting(true)}
            className="absolute -top-1 -left-1 w-10 h-10 p-0 border-0 cursor-pointer"
          />
        </div>
        {isSelecting && (
          <>
            <button
              onClick={handleConfirm}
              className="text-green-600 hover:text-green-700 text-sm leading-none"
              title="确认"
            >
              ✓
            </button>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 text-sm leading-none"
              title="取消"
            >
              ↩
            </button>
          </>
        )}
      </div>
    </div>
  );
}
