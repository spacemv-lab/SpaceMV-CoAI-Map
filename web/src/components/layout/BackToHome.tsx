/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { ArrowLeft, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMapStore } from '@/features/map-core';

interface BackToHomeProps {
  projectName?: string;
}

export default function BackToHome({ projectName }: BackToHomeProps) {
  const navigate = useNavigate();
  const setCurrentProjectId = useMapStore((state) => state.setCurrentProjectId);

  const handleBackToHome = () => {
    // 清空 projectId，触发保存当前工程状态
    setCurrentProjectId(null);
    navigate('/');
  };

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={handleBackToHome}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <Home className="w-4 h-4" />
        <span>返回首页</span>
      </button>
      {projectName && (
        <div className="flex items-center gap-2">
          <div className="w-px h-4 bg-border" />
          <span className="font-medium">{projectName}</span>
        </div>
      )}
    </div>
  );
}
