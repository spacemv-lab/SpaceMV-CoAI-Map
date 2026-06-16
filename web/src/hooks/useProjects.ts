/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api/auth-api';
import { getCurrentUserId } from '../constants/user';

interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  datasetCount?: number;
}

interface ProjectsResponse {
  items: Project[];
  total: number;
}

interface ApiResponse<T> {
  code: number;
  data: T;
  msg: string;
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response: ApiResponse<ProjectsResponse> = await apiFetch('/projects');
      setProjects(response.data?.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createProject = useCallback(async (name: string, description?: string) => {
    const response: ApiResponse<Project> = await apiFetch('/projects', {
      method: 'POST',
      body: JSON.stringify({ name, description, ownerId: getCurrentUserId() }),
    });
    const newProject = response.data;
    setProjects((prev) => [newProject, ...prev]);
    return newProject;
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    await apiFetch(`/projects/${id}`, { method: 'DELETE' });
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return { projects, isLoading, error, createProject, deleteProject, refetch: fetchProjects };
}
