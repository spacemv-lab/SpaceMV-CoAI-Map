/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useState, useCallback } from 'react';
import { UploadResult } from '../types';
import { datasetApi } from '../api/dataset.api';

interface UseUploadOptions {
  projectId: string;
  onSuccess?: (result: UploadResult) => void;
  onError?: (error: Error) => void;
}

interface UseUploadResult {
  uploading: boolean;
  progress: number;
  error: Error | null;
  upload: (file: File, options?: UploadOptions) => Promise<UploadResult | null>;
  cancel: () => void;
}

interface UploadOptions {
  name?: string;
  tags?: string[];
  description?: string;
  targetCRS?: string;
  mappingProfileId?: string;
}

export function useUpload(options: UseUploadOptions): UseUploadResult {
  const { projectId, onSuccess, onError } = options;
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const upload = useCallback(
    async (file: File, uploadOptions?: UploadOptions): Promise<UploadResult | null> => {
      setUploading(true);
      setProgress(0);
      setError(null);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('projectId', projectId);

        if (uploadOptions?.name) formData.append('name', uploadOptions.name);
        if (uploadOptions?.tags) {
          uploadOptions.tags.forEach((tag) => formData.append('tags', tag));
        }
        if (uploadOptions?.description)
          formData.append('description', uploadOptions.description);
        if (uploadOptions?.targetCRS)
          formData.append('targetCRS', uploadOptions.targetCRS);
        if (uploadOptions?.mappingProfileId)
          formData.append('mappingProfileId', uploadOptions.mappingProfileId);

        setProgress(50);

        const result = await datasetApi.upload(formData);

        setProgress(100);

        setUploading(false);
        onSuccess?.(result as UploadResult);

        return result as UploadResult;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Upload failed');
        setError(error);
        setUploading(false);
        onError?.(error);
        return null;
      }
    },
    [projectId, onSuccess, onError]
  );

  const cancel = useCallback(() => {
    // AbortController could be implemented here for actual cancellation
    setUploading(false);
    setProgress(0);
  }, []);

  return {
    uploading,
    progress,
    error,
    upload,
    cancel,
  };
}