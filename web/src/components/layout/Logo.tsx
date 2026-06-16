/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Map } from 'lucide-react';

export default function Logo() {
  return (
    <div className="flex items-center gap-3 select-none cursor-pointer group">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
        <Map className="w-5 h-5 text-primary" />
      </div>
      <span className="font-display font-semibold tracking-tight text-xl">
        SpaceMV-CoAI-Map
      </span>
    </div>
  );
}
