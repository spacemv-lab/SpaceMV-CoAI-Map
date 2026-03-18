/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { Map } from 'lucide-react';

export default function Logo() {
  return (
    <div className="flex items-center gap-2 select-none cursor-pointer">
      <Map className="w-5 h-5 text-primary" />
      <span className="font-semibold tracking-wide">宜宾数字烟田地图</span>
    </div>
  );
}
