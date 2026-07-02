/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useParams } from 'react-router-dom';
import { Whiteboard } from '@/features/whiteboard';

/**
 * Project Board Page — 白板（一站式配图）。
 *
 * 嵌在 ProjectLayout 内，占满高度供 tldraw 画布渲染。
 */
export default function BoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;

  return (
    <div className="w-full h-full">
      <Whiteboard projectId={projectId} />
    </div>
  );
}
