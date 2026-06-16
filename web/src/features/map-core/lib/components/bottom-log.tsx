/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { PROJECT_BRAND } from '../constants/brand';

export function BottomLog() {
  return (
    <div className="flex items-center gap-4">
      <div className="figure-number flex items-center gap-1">
        <span className="font-semibold text-sm tracking-wider text-gray-700 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          {PROJECT_BRAND.name}
        </span>
      </div>
    </div>
  );
}
