/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { GeometryType, LayerState, LayerStyle } from './map-state';

/**
 * 精简图层持久化状态 - 只保存恢复所需的元信息
 *
 * 排除字段：
 * - data: GeoJSON 完整数据（太大）
 * - dataSource: Cesium DataSource 引用（非序列化）
 * - routingMetadata / runtimeRoute: 运行时计算
 * - fields: 可从 data 推断
 * - featureOverrides: 暂不持久化
 */
export interface PersistedLayerState {
  id: string;
  name: string;
  type: LayerState['type'];
  geometryType?: GeometryType;
  visible: boolean;
  opacity: number;
  style: LayerStyle;
  sourceId?: string;
}

/**
 * 持久化地图状态
 */
export interface PersistedMapState {
  viewport: {
    center: [number, number];
    zoom: number;
    heading: number;
    pitch: number;
  };
  basemap: string;
  layers: PersistedLayerState[];
}
