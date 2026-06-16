/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { DeviceClass, SceneType } from '../types/map-state';

export type MapPerformanceMetricName =
  | 'baseline.device-class'
  | 'map.initialize'
  | 'maplibre.initialize'
  | 'layer.fetch'
  | 'layer.attach'
  | 'layer.first-stable-frame'
  | 'interaction.hover'
  | 'interaction.popup'
  | 'interaction.zoom-to-layer'
  | 'interaction.attribute-panel'
  | 'interaction.style-panel'
  | 'interaction.label-panel';

export interface MapPerformanceMetric {
  name: MapPerformanceMetricName;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  deviceClass: DeviceClass;
  sceneType?: SceneType;
  layerId?: string;
  metadata?: Record<string, unknown>;
}

declare global {
  interface Window {
    __MAP_CORE_PERFORMANCE__?: MapPerformanceMetric[];
  }
}

type MetricBase = Omit<
  MapPerformanceMetric,
  'startedAt' | 'endedAt' | 'durationMs' | 'deviceClass'
>;

/**
 * 在客户端运行时返回浏览器 `window` 对象。
 * 这样监控工具在 SSR 或测试环境中被导入时也不会直接报错。
 */
function getRuntimeWindow(): Window | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window;
}

/**
 * 基于视口尺寸和指针类型，将当前运行环境粗分为移动端或桌面端。
 * 该结果会挂到性能指标上，供后续按设备类型设置阈值或做分析。
 */
export function detectDeviceClass(): DeviceClass {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) {
    return 'desktop';
  }

  const mobileMatch = runtimeWindow.matchMedia?.(
    '(max-width: 767px), (pointer: coarse)',
  ).matches;

  if (mobileMatch) {
    return 'mobile';
  }

  return 'desktop';
}

/**
 * 将一条完整的性能指标写入运行时内存缓冲区，并派发浏览器事件。
 * 调用方可以不传 `deviceClass`，由监控器自动补齐。
 *
 * @param metric 调用方或 span 封装器产出的完整指标对象。
 * @returns 归一化后的最终指标，同时也是实际被存储和派发的对象。
 */
export function recordPerformanceMetric(
  metric: Omit<MapPerformanceMetric, 'deviceClass'> & {
    deviceClass?: DeviceClass;
  },
): MapPerformanceMetric {
  const runtimeWindow = getRuntimeWindow();
  const resolvedMetric: MapPerformanceMetric = {
    ...metric,
    deviceClass: metric.deviceClass ?? detectDeviceClass(),
  };

  if (!runtimeWindow) {
    return resolvedMetric;
  }

  if (!runtimeWindow.__MAP_CORE_PERFORMANCE__) {
    runtimeWindow.__MAP_CORE_PERFORMANCE__ = [];
  }

  runtimeWindow.__MAP_CORE_PERFORMANCE__.push(resolvedMetric);
  runtimeWindow.dispatchEvent(
    new CustomEvent('map-core:performance-metric', {
      detail: resolvedMetric,
    }),
  );

  return resolvedMetric;
}

/**
 * 启动一个轻量级计时 span，并返回一个用于结束计时的函数。
 * 结束函数会把起始时的基础元数据与结束时追加的元数据合并后写入指标。
 *
 * @param base 在开始计时时已经确定的稳定指标字段。
 * @returns 一个结束函数；调用后会记录本次完整性能指标。
 */
export function startPerformanceSpan(base: MetricBase) {
  const startedAt = performance.now();

  return (metadata?: Record<string, unknown>) => {
    const endedAt = performance.now();

    return recordPerformanceMetric({
      ...base,
      metadata: {
        ...base.metadata,
        ...metadata,
      },
      startedAt,
      endedAt,
      durationMs: endedAt - startedAt,
    });
  };
}

/**
 * 包装一个异步动作并记录其总耗时，即使动作抛错也会落指标。
 *
 * @param base 本次异步测量共享的稳定指标字段。
 * @param action 需要被计时的异步操作。
 * @param metadata 在 span 结束时追加的可选元数据。
 * @returns 原样返回 `action` 的执行结果。
 */
export async function measureAsyncPerformance<T>(
  base: MetricBase,
  action: () => Promise<T>,
  metadata?: Record<string, unknown>,
): Promise<T> {
  const endSpan = startPerformanceSpan(base);

  try {
    return await action();
  } finally {
    endSpan(metadata);
  }
}

/**
 * 记录一个零耗时的交互型指标。
 * 适用于 hover、click、打开面板这类不需要 span 计时的瞬时事件。
 *
 * @param name 交互指标名称，限制为 `interaction.*` 命名空间。
 * @param metadata 可选事件上下文，例如图层 ID 或触发来源。
 * @returns 归一化后的最终指标，同时也是实际被存储和派发的对象。
 */
export function recordInteractionMetric(
  name: Extract<MapPerformanceMetricName, `interaction.${string}`>,
  metadata?: Record<string, unknown>,
) {
  const endedAt = performance.now();

  return recordPerformanceMetric({
    name,
    startedAt: endedAt,
    endedAt,
    durationMs: 0,
    metadata,
  });
}
