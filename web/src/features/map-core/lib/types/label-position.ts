/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 标注位置类型定义
 * 根据要素几何类型，标注位置有不同的选项
 */

/**
 * 点要素标注位置（完整九宫格）
 */
export type PointLabelPosition =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center';

/**
 * 线要素标注位置
 */
export type LineLabelPosition = 'along' | 'start' | 'end' | 'middle';

/**
 * 面要素标注位置
 */
export type PolygonLabelPosition = 'center' | 'boundary';

/**
 * 面要素标注放置模式
 * - auto: 自动寻位（text-variable-anchor，引擎在候选锚点里挑不重叠的位置）
 * - fixed: 固定锚点（text-anchor + text-offset）
 */
export type PolygonLabelPlacementMode = 'auto' | 'fixed';

/**
 * auto 模式默认候选锚点（九宫格全选）
 */
export const DEFAULT_LABEL_ANCHOR_CANDIDATES: PointLabelPosition[] = [
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
];

/**
 * 联合类型 - 所有标注位置选项
 */
export type LabelPosition =
  | PointLabelPosition
  | LineLabelPosition
  | PolygonLabelPosition;

/**
 * 标注位置到 MapLibre text-anchor 的映射
 */
export const LABEL_POSITION_TO_ANCHOR: Record<string, string> = {
  // 点要素九宫格
  'top': 'top',
  'bottom': 'bottom',
  'left': 'left',
  'right': 'right',
  'top-left': 'top-left',
  'top-right': 'top-right',
  'bottom-left': 'bottom-left',
  'bottom-right': 'bottom-right',
  'center': 'center',
  // 线/面要素默认使用 center
  'along': 'center',
  'start': 'center',
  'end': 'center',
  'middle': 'center',
  'boundary': 'center',
};

/**
 * 获取标注位置对应的 MapLibre text-anchor
 */
export function getLabelAnchor(position?: LabelPosition): string {
  if (!position) return 'center';
  return LABEL_POSITION_TO_ANCHOR[position] || 'center';
}

/**
 * 根据几何类型获取默认标注位置
 */
export function getDefaultLabelPosition(geometryType?: 'POINT' | 'LINESTRING' | 'POLYGON'): LabelPosition {
  switch (geometryType) {
    case 'POINT':
      return 'top';
    case 'LINESTRING':
      return 'along';
    case 'POLYGON':
      return 'center';
    default:
      return 'center';
  }
}