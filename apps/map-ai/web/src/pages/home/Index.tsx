/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import React, { useState } from 'react';
import { MapViewer } from '@map-ai/features/map-core';
// import { Demo, useSocketChat } from '@map-ai/features/ai-chat/web';

export default function Home() {
  return (
    <div className="flex w-full h-full overflow-hidden">
      {/* <div className="chat-window basis-[40%] min-w-[280px] h-full z-10 shadow-2xl rounded-xl overflow-hidden">
        <Demo url="http://localhost:3000" embedded />
      </div> */}
      <div className="map-container basis-[60%] flex-1 min-h-0">
        <MapViewer />
      </div>
    </div>
  );
}
