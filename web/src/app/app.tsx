/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import React from 'react';
import { MapViewer } from '@/features/map-core';

export function App() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-background">
      <MapViewer />

    </div>
  );
}

export default App;
