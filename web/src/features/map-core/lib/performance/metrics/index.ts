/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 性能指标定义层
 *
 * 定义：
 * - 指标语义（测什么）
 * - 单位和阈值
 * - 性能预算
 */

export type MetricUnit = 'ms' | 'bytes' | 'fps' | 'count';

export interface MetricDefinition {
  name: string;                   // 指标标识符
  displayName: string;            // 报告中显示名称
  unit: MetricUnit;               // 单位
  description: string;            // 指标语义说明
  budget?: number;                // 性能预算阈值（可选）
}

/**
 * 指标注册表
 */
export const METRICS: Record<string, MetricDefinition> = {
  // ============================================
  // 网络层指标
  // ============================================
  dataTransfer: {
    name: 'dataTransfer',
    displayName: '数据传输量',
    unit: 'bytes',
    description: '从服务器获取的总数据量（GeoJSON全量或MVT瓦片累计）',
    budget: 2 * 1024 * 1024, // 2MB
  },
  fetchDuration: {
    name: 'fetchDuration',
    displayName: '数据请求耗时',
    unit: 'ms',
    description: '从发起请求到收到响应的时间',
    budget: 2000,
  },

  // ============================================
  // 时间层指标
  // ============================================
  parseDuration: {
    name: 'parseDuration',
    displayName: '数据解析耗时',
    unit: 'ms',
    description: '解析数据格式的时间（GeoJSON解析或MVT解码）',
    budget: 500,
  },
  firstRender: {
    name: 'firstRender',
    displayName: '首帧渲染时间',
    unit: 'ms',
    description: '从数据就绪到首次画面呈现的时间',
    budget: 300,
  },
  totalDuration: {
    name: 'totalDuration',
    displayName: '总加载时间',
    unit: 'ms',
    description: '从开始加载到渲染完成的全程时间',
    budget: 3000,
  },

  // ============================================
  // 运行时指标
  // ============================================
  memoryPeak: {
    name: 'memoryPeak',
    displayName: '内存峰值',
    unit: 'bytes',
    description: '渲染过程中的最大内存占用',
    budget: 100 * 1024 * 1024, // 100MB
  },
  fpsAverage: {
    name: 'fpsAverage',
    displayName: '平均帧率',
    unit: 'fps',
    description: '地图交互时的平均 FPS',
    budget: 45,
  },
  fpsP95: {
    name: 'fpsP95',
    displayName: 'P95帧率',
    unit: 'fps',
    description: '95%帧率分位数（排除极端低帧）',
    budget: 30,
  },
  fpsMin: {
    name: 'fpsMin',
    displayName: '最低帧率',
    unit: 'fps',
    description: '交互过程中的最低帧率',
    budget: 20,
  },
};