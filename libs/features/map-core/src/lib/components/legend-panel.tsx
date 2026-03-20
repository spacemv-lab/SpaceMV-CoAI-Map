/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { useState } from 'react';
import { List, X } from 'lucide-react';

export function LegendPanel() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="bg-white/90 backdrop-blur rounded-lg shadow-lg border p-2 text-gray-600 hover:text-gray-800 hover:bg-white transition-colors"
        title="显示图例"
      >
        <List className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="bg-white/90 backdrop-blur rounded-lg shadow-lg border p-4 w-48 text-sm relative">
      <button
        onClick={() => setIsVisible(false)}
        className="absolute top-1 right-1 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        title="隐藏图例"
      >
        <X className="w-3 h-3" />
      </button>
      <h4 className="font-medium mb-3 text-gray-800">图例</h4>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded-full" />
          <span className="text-gray-700">当前位置</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded" />
          <span className="text-gray-700">选中区域</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-green-500 rounded" />
          <span className="text-gray-700">路径</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-500/50 border border-yellow-500 rounded" />
          <span className="text-gray-700">多边形区域</span>
        </div>
      </div>
    </div>
  );
}
