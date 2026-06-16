/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useMapStore } from '../../store/use-map-store';
import { EditPanel } from './edit-panel';

export function EditPanelWrapper() {
  const isOpen = useMapStore((state) => state.editPanel.isOpen);

  return (
    <div
      className="absolute right-4 overflow-hidden transition-all duration-300 ease-in-out"
      style={{
        top: isOpen ? '8rem' : '8rem',
        bottom: isOpen ? '1rem' : 'auto',
        width: isOpen ? '320px' : '0px',
      }}
    >
      <EditPanel />
    </div>
  );
}
