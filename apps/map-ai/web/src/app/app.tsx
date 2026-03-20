/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import React, { useState } from 'react';
import { Demo } from '@map-ai/features/ai-chat/web';
import { MapViewer } from '@map-ai/features/map-core';
import { useSocketChat } from '@map-ai/features/ai-chat/web';

export function App() {
  const [pendingPlan, setPendingPlan] = useState<any | null>(null);
  const chatWs = useSocketChat({ url: 'http://localhost:3000' });

  // const planPanel = pendingPlan ? (
  //   <div
  //     className="absolute bottom-4 right-4 z-10 p-4 rounded-xl shadow bg-white/90 border"
  //     style={{ borderColor: '#e5e7eb', minWidth: 300 }}
  //   >
  //     <div className="font-medium mb-2">计划确认</div>
  //     <div className="text-xs mb-2" style={{ color: '#374151' }}>
  //       {pendingPlan?.rationale || '该计划包含以下步骤'}
  //     </div>
  //     <ul className="list-disc pl-5 mb-3">
  //       {(pendingPlan?.steps || []).map((s: any, i: number) => (
  //         <li key={i} className="text-sm">
  //           {s?.type}
  //         </li>
  //       ))}
  //     </ul>
  //     <div className="flex gap-2">
  //       <button
  //         className="px-3 py-1 rounded bg-blue-600 text-white"
  //         onClick={() => {
  //           chatWs.planAck({
  //             conversationId: 'global',
  //             planId: pendingPlan?.planId || 'plan',
  //             status: 'confirmed',
  //           });
  //           setPendingPlan(null);
  //         }}
  //       >
  //         确认
  //       </button>
  //       <button
  //         className="px-3 py-1 rounded bg-gray-200"
  //         onClick={() => {
  //           chatWs.planAck({
  //             conversationId: 'global',
  //             planId: pendingPlan?.planId || 'plan',
  //             status: 'rejected',
  //           });
  //           setPendingPlan(null);
  //         }}
  //       >
  //         拒绝
  //       </button>
  //     </div>
  //   </div>
  // ) : null;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-background">
      <MapViewer
        socketUrl="http://localhost:3000"
        className="absolute inset-0 z-0"
      />

      {/* Floating Chat Window */}
      {/* <div className="chat-window absolute top-4 left-4 w-[350px] h-[600px] z-10 shadow-2xl rounded-xl">
        <Demo url="http://localhost:3000" />
      </div> */}
      {/* {planPanel} */}
    </div>
  );
}

export default App;
