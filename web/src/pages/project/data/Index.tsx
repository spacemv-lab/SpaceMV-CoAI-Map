/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useParams } from 'react-router-dom';
import { GisDataManager } from '@/features/gis-data-manager';

/**
 * Project Data Page
 *
 * Displays GIS data management for a specific project.
 * Uses PROJECT scope to show project-private datasets.
 */
export default function ProjectDataPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <GisDataManager
      projectId={projectId}
      scope="PROJECT"
      isInProject={true}
    />
  );
}