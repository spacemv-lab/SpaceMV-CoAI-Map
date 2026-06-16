/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { MapArea } from './map-area';

/**
 * MapViewer is now just a container that renders MapArea.
 * The right panel is rendered by the parent (Home.tsx) in a flex layout.
 * This keeps backward compatibility for any code that imports MapViewer.
 */
export function MapViewer() {
  return <MapArea />;
}