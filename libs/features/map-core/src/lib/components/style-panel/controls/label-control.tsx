/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { Type } from 'lucide-react';
import { LabelStyle } from '../../../types/map-state';

interface LabelControlProps {
  value: LabelStyle | undefined;
  onChange: (label: LabelStyle) => void;
  featureProperties?: string[]; // 可用的属性字段列表
}

export function LabelControl({ value, onChange, featureProperties = [] }: LabelControlProps) {
  const enabled = !!value?.text;
  const text = value?.text || '';
  const font = value?.font || '14px sans-serif';
  const fillColor = value?.fillColor || '#ffffff';
  const outlineColor = value?.outlineColor || '#000000';
  const outlineWidth = value?.outlineWidth ?? 1;
  // labelOffset: Billboard 顶部到文字底部的距离（像素），默认为 10
  const labelOffset = value?.labelOffset ?? 10;

  const handleToggle = (checked: boolean) => {
    if (checked) {
      onChange({
        ...value,
        text: featureProperties.length > 0 ? `{${featureProperties[0]}}` : '',
      });
    } else {
      onChange({ ...value, text: '' });
    }
  };

  const handleTextChange = (newText: string) => {
    onChange({ ...value, text: newText });
  };

  const handleFontChange = (newFont: string) => {
    onChange({ ...value, font: newFont });
  };

  const handleFillColorChange = (newColor: string) => {
    onChange({ ...value, fillColor: newColor });
  };

  const handleOutlineColorChange = (newColor: string) => {
    onChange({ ...value, outlineColor: newColor });
  };

  const handleOutlineWidthChange = (newWidth: number) => {
    onChange({ ...value, outlineWidth: newWidth });
  };

  const handleLabelOffsetChange = (newOffset: number) => {
    onChange({ ...value, labelOffset: newOffset });
  };

  return (
    <div className="space-y-3">
      {/* 开关和标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-gray-500" />
          <label className="text-sm text-gray-600">文字标注</label>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm text-gray-500">启用</span>
        </label>
      </div>

      {/* 配置选项 */}
      {enabled && (
        <>
          {/* 标注文字 */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">标注内容</label>
            {featureProperties.length > 0 ? (
              <>
                <select
                  value={text.startsWith('{') ? text : 'custom'}
                  onChange={(e) => handleTextChange(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm bg-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="">选择字段...</option>
                  {featureProperties.map((field) => (
                    <option key={field} value={`{${field}}`}>
                      {field}
                    </option>
                  ))}
                  <option value="custom">自定义...</option>
                </select>
                {text === 'custom' && (
                  <input
                    type="text"
                    placeholder="输入标注文字"
                    onChange={(e) => handleTextChange(e.target.value)}
                    value={text}
                    className="w-full mt-2 px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:border-blue-500 focus:outline-none"
                  />
                )}
              </>
            ) : (
              <input
                type="text"
                placeholder="输入标注文字"
                onChange={(e) => handleTextChange(e.target.value)}
                value={text}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:border-blue-500 focus:outline-none"
              />
            )}
          </div>

          {/* 字体大小滑块 */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">字体大小</label>
            <input
              type="range"
              min="10"
              max="48"
              step="2"
              value={parseInt(font) || 14}
              onChange={(e) => handleFontChange(`${e.target.value}px sans-serif`)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>10px</span>
              <span>{parseInt(font) || 14}px</span>
              <span>48px</span>
            </div>
          </div>

          {/* 颜色设置 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">填充颜色</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={fillColor}
                  onChange={(e) => handleFillColorChange(e.target.value)}
                  className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
                />
                <span className="text-xs text-gray-600 font-mono">{fillColor}</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">轮廓颜色</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={outlineColor}
                  onChange={(e) => handleOutlineColorChange(e.target.value)}
                  className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
                />
                <span className="text-xs text-gray-600 font-mono">{outlineColor}</span>
              </div>
            </div>
          </div>

          {/* 轮廓宽度 */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">轮廓宽度</label>
            <input
              type="range"
              min="0"
              max="4"
              step="1"
              value={outlineWidth}
              onChange={(e) => handleOutlineWidthChange(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>无</span>
              <span>{outlineWidth}px</span>
              <span>粗</span>
            </div>
          </div>

          {/* 标注距离滑块 */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              标注距离（文字底部到图标顶部的距离）
            </label>
            <input
              type="range"
              min="0"
              max="50"
              step="1"
              value={labelOffset}
              onChange={(e) => handleLabelOffsetChange(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>0px</span>
              <span>{labelOffset}px</span>
              <span>50px</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
