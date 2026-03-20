/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { GisDataManager } from '@txwx-monorepo/gis-data-manger';

export default function DataManager() {
  return (
    <div className="data-manager  flex items-center justify-center">
      <div className="rounded-xl border bg-background/60 backdrop-blur px-6 py-4">
        <GisDataManager />
      </div>
    </div>
  );
}
