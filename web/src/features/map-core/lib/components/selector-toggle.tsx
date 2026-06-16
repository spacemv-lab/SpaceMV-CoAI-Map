/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useMapStore } from '../store/use-map-store';
import { Crosshair } from 'lucide-react';

export function SelectorToggle() {
  const selectorMode =
    useMapStore((state) => state.experimental?.selectorMode ?? false);
  const setExperimental = useMapStore((state) => state.setExperimental);

  return (
    <button
      onClick={() =>
        setExperimental({ selectorMode: !selectorMode })
      }
      className={`p-2 rounded transition-colors ${
        selectorMode
          ? 'bg-blue-100 text-blue-600'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
      title={selectorMode ? '退出选择模式' : '进入选择模式（双击编辑）'}
    >
      <Crosshair className="w-5 h-5" />
    </button>
  );
}
