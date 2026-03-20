/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { ColorControl } from './color-control';
import { WidthControl } from './width-control';

interface OutlineControlProps {
  outlineColor?: string;
  outlineWidth?: number;
  onChangeColor: (color: string) => void;
  onChangeWidth: (width: number) => void;
}

export function OutlineControl({
  outlineColor,
  outlineWidth,
  onChangeColor,
  onChangeWidth,
}: OutlineControlProps) {
  return (
    <>
      <ColorControl
        value={outlineColor || '#cccccc'}
        onChange={onChangeColor}
        label="边框颜色"
      />
      <WidthControl
        value={outlineWidth || 1}
        label="边框宽度"
        onChange={onChangeWidth}
      />
    </>
  );
}
