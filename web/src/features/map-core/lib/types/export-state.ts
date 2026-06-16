/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * Map element preset positions
 */
export type ElementPresetPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/**
 * North arrow style options (1-5)
 */
export type NorthArrowStyle = 1 | 2 | 3 | 4 | 5;

/**
 * Single map element configuration
 */
export interface MapElementConfig {
  enabled: boolean;
  preset: ElementPresetPosition;
  offsetX: number; // -50 to +50: -50 = left edge, 0 = center, +50 = right edge
  offsetY: number; // -50 to +50: -50 = top edge, 0 = center, +50 = bottom edge
}

/**
 * North arrow specific config with style
 */
export interface NorthArrowConfig extends MapElementConfig {
  style: NorthArrowStyle;
}

/**
 * Legend configuration
 */
export interface LegendConfig extends MapElementConfig {
  // No additional fields, uses base MapElementConfig
}

/**
 * Tianditu attribution configuration
 */
export interface TiandituConfig extends MapElementConfig {
  // No additional fields, uses base MapElementConfig
}

/**
 * Export panel configuration
 */
export interface ExportConfig {
  title: MapElementConfig & { text: string };
  northArrow: NorthArrowConfig;
  scaleBar: MapElementConfig;
  legend: LegendConfig;
  tianditu: TiandituConfig;
}

/**
 * Export panel state
 */
export interface ExportPanelState {
  isOpen: boolean;
  selectionBox: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null;
  config: ExportConfig;
  pixelSize: { width: number; height: number } | null;
}

/**
 * Get offset values for a preset position
 * Preset is just a shortcut to set slider values
 */
export function getOffsetsForPreset(preset: ElementPresetPosition): { offsetX: number; offsetY: number } {
  // Using ±40 instead of ±50 to leave margin at edges
  switch (preset) {
    case 'top-left':
      return { offsetX: -40, offsetY: -40 };
    case 'top-center':
      return { offsetX: 0, offsetY: -40 };
    case 'top-right':
      return { offsetX: 40, offsetY: -40 };
    case 'bottom-left':
      return { offsetX: -40, offsetY: 40 };
    case 'bottom-center':
      return { offsetX: 0, offsetY: 40 };
    case 'bottom-right':
      return { offsetX: 40, offsetY: 40 };
  }
}

/**
 * Default export config
 */
export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  title: {
    enabled: true,
    text: '地图',
    preset: 'top-center',
    offsetX: 0,
    offsetY: -40,
  },
  northArrow: {
    enabled: true,
    preset: 'top-right',
    offsetX: 40,
    offsetY: -40,
    style: 1,
  },
  scaleBar: {
    enabled: true,
    preset: 'bottom-left',
    offsetX: -40,
    offsetY: 40,
  },
  legend: {
    enabled: true,
    preset: 'bottom-right',
    offsetX: 40,
    offsetY: 40,
  },
  tianditu: {
    enabled: true,
    preset: 'bottom-left',
    offsetX: -40,
    offsetY: 40,
  },
};