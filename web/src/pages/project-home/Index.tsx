/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderOpen } from 'lucide-react';
import ProjectCard from './ProjectCard';
import CreateProjectModal from './CreateProjectModal';
import { useProjects } from '../../hooks/useProjects';

export default function ProjectHomePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  const { projects, isLoading, error, createProject, deleteProject } = useProjects();

  const handleCreateProject = async (name: string) => {
    const newProject = await createProject(name);
    navigate(`/project/${newProject.id}/map`);
  };

  return (
    <div className="flex flex-col w-full h-full overflow-hidden p-6">
      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* 新建工程大横条 */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="w-full flex items-center gap-4 p-5 rounded-xl bg-muted/30 border border-border hover:bg-muted/50 hover:border-primary/30 hover:shadow-sm transition-all duration-200 mb-6 group"
      >
        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
          <Plus className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <span className="text-base font-medium">新建工程</span>
          <p className="text-sm text-muted-foreground mt-0.5">创建新的地图工程项目</p>
        </div>
      </button>

      {/* 工程列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          加载中...
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FolderOpen className="w-16 h-16 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">暂无工程，点击上方按钮创建</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 overflow-y-auto flex-1">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              id={project.id}
              name={project.name}
              datasetCount={project.datasetCount || 0}
              updatedAt={project.updatedAt}
              onDelete={deleteProject}
            />
          ))}
        </div>
      )}

      {/* 创建弹窗 */}
      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateProject}
      />
    </div>
  );
}
