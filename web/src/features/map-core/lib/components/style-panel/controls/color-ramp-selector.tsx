/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useState } from 'react';
import { COLOR_RAMPS, getColorsForClasses } from '../../../constants/color-ramps';

interface ColorRampSelectorProps {
  value: string;
  onChange: (rampId: string) => void;
  classes: number;
}

/**
 * 色阶预览条
 */
function ColorRampPreview({ colors }: { colors: string[] }) {
  return (
    <div className="flex h-4 rounded overflow-hidden border border-gray-200">
      {colors.map((color, i) => (
        <div
          key={i}
          className="flex-1"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

export function ColorRampSelector({ value, onChange, classes }: ColorRampSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentRamp = COLOR_RAMPS.find((r) => r.id === value) || COLOR_RAMPS[0];
  const previewColors = getColorsForClasses(value || 'blues', classes || 5);

  return (
    <div className="mb-3 relative">
      <label className="text-sm text-gray-600 block mb-1">色阶预设</label>

      {/* Current selection preview */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-2 py-1.5 border border-gray-200 rounded-md text-sm bg-white hover:border-gray-300 focus:border-blue-500 focus:outline-none"
      >
        <div className="w-16">
          <ColorRampPreview colors={previewColors} />
        </div>
        <span className="text-gray-700 flex-1 text-left">{currentRamp.name}</span>
        <span className="text-gray-400">▼</span>
      </button>

      {/* Dropdown with all ramps */}
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
          {COLOR_RAMPS.map((ramp) => {
            const colors = getColorsForClasses(ramp.id, classes || 5);
            const isSelected = ramp.id === value;
            return (
              <button
                key={ramp.id}
                onClick={() => {
                  onChange(ramp.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-2 py-2 text-sm hover:bg-gray-50 ${
                  isSelected ? 'bg-blue-50' : ''
                }`}
              >
                <div className="w-16">
                  <ColorRampPreview colors={colors} />
                </div>
                <span className="text-gray-700 flex-1">{ramp.name}</span>
                {isSelected && (
                  <span className="text-blue-600">✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}