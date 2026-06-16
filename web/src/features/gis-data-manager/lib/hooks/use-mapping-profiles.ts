/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useState, useEffect, useCallback } from 'react';
import { MappingProfile } from '../types';
import { mappingApi } from '../api/mapping.api';

interface UseMappingProfilesOptions {
  datasetId?: string;
  autoFetch?: boolean;
}

interface UseMappingProfilesResult {
  profiles: MappingProfile[];
  loading: boolean;
  error: Error | null;
  fetchProfiles: () => Promise<void>;
  createProfile: (data: Partial<MappingProfile>) => Promise<MappingProfile | null>;
  updateProfile: (id: string, data: Partial<MappingProfile>) => Promise<MappingProfile | null>;
  deleteProfile: (id: string) => Promise<boolean>;
}

export function useMappingProfiles(
  options: UseMappingProfilesOptions = {}
): UseMappingProfilesResult {
  const { datasetId, autoFetch = true } = options;

  const [profiles, setProfiles] = useState<MappingProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfiles = useCallback(async () => {
    if (!datasetId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await mappingApi.list(datasetId);
      setProfiles(data.items);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch profiles'));
    } finally {
      setLoading(false);
    }
  }, [datasetId]);

  useEffect(() => {
    if (autoFetch && datasetId) {
      fetchProfiles();
    }
  }, [autoFetch, datasetId, fetchProfiles]);

  const createProfile = useCallback(
    async (data: Partial<MappingProfile>): Promise<MappingProfile | null> => {
      try {
        const profile = await mappingApi.create(data as Omit<MappingProfile, 'id' | 'createdAt' | 'updatedAt'>);
        setProfiles((prev) => [...prev, profile]);
        return profile;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to create profile'));
        return null;
      }
    },
    []
  );

  const updateProfile = useCallback(
    async (id: string, data: Partial<MappingProfile>): Promise<MappingProfile | null> => {
      try {
        const profile = await mappingApi.update(id, data);
        setProfiles((prev) => prev.map((p) => (p.id === id ? profile : p)));
        return profile;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to update profile'));
        return null;
      }
    },
    []
  );

  const deleteProfile = useCallback(async (id: string): Promise<boolean> => {
    try {
      await mappingApi.delete(id);
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete profile'));
      return false;
    }
  }, []);

  return {
    profiles,
    loading,
    error,
    fetchProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
  };
}