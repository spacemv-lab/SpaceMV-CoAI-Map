/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Map, Calendar, Trash2 } from 'lucide-react';

interface ProjectCardProps {
  id: string;
  name: string;
  datasetCount: number;
  updatedAt: string;
  onDelete?: (id: string) => Promise<void>;
}

export default function ProjectCard({ id, name, datasetCount, updatedAt, onDelete }: ProjectCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const formattedDate = new Date(updatedAt).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!onDelete || isDeleting) return;

    if (!window.confirm(`确认要删除工程 "${name}" 吗？\n删除后无法恢复。`)) return;

    setIsDeleting(true);
    try {
      await onDelete(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Link
      to={`/project/${id}/map`}
      className="group relative flex items-center justify-between p-4 rounded-xl bg-card border border-border hover:border-primary/40 hover:shadow-md transition-all duration-200 w-full"
    >
      {/* Hover时的左侧强调线 */}
      <div className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full bg-transparent group-hover:bg-primary/50 transition-colors" />

      <div className="flex-1 pl-1">
        <h3 className="font-medium text-base group-hover:text-primary transition-colors">
          {name}
        </h3>
        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1.5">
          <span className="flex items-center gap-1.5">
            <Map className="w-4 h-4" />
            {datasetCount} 个图层
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            {formattedDate}
          </span>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        {onDelete && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-10 h-10 rounded-lg bg-muted/30 flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
            title="删除工程"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
        <div className="w-10 h-10 rounded-lg bg-muted/30 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
          <Map className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>
    </Link>
  );
}
