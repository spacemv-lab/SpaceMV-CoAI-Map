/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useMemo } from 'react';
import { GraduatedConfig } from '../../../types/graduated-style';
import { computeGraduatedLegendItems } from '../../../utils/graduated-legend';

interface GraduatedLegendPreviewProps {
  config: GraduatedConfig;
}

export function GraduatedLegendPreview({ config }: GraduatedLegendPreviewProps) {
  // 复用共享计算，保证样式面板预览与浮动图例/导出图例三端一致
  const legendItems = useMemo(() => computeGraduatedLegendItems(config), [config]);

  return (
    <div className="mt-4">
      <div className="text-sm text-gray-600 mb-2">图例预览</div>
      <div className="bg-gray-50 rounded p-2 border border-gray-100">
        {legendItems.map((item, i) => (
          <div key={i} className="flex items-center gap-2 py-1">
            <div
              className="w-4 h-4 rounded border border-gray-200"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-gray-600">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
