/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Outlet, useParams } from 'react-router-dom';
import FloatingNav from '../../components/FloatingNav';

export default function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>();

  // projectId is guaranteed by route definition '/project/:projectId'
  if (!projectId) {
    return <Outlet />;
  }

  return (
    <div className="relative w-full h-full">
      <FloatingNav projectId={projectId} />
      <Outlet />
    </div>
  );
}