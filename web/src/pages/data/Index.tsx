/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { GisDataManager } from '@/features/gis-data-manager';

export default function DataManager() {
  return (
    <div className="data-manager flex items-center justify-center w-full h-full">
      <GisDataManager
        projectId={null}
        scope="GLOBAL"
      />
    </div>
  );
}