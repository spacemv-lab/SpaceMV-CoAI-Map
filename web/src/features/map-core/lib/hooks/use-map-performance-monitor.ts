/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useEffect } from 'react';
import { DeviceClass, SceneType } from '../types/map-state';
import {
  detectDeviceClass,
  recordPerformanceMetric,
} from '../monitoring/performance-monitor';

interface UseMapPerformanceMonitorOptions {
  sceneType?: SceneType;
}

export function useMapPerformanceMonitor(
  options: UseMapPerformanceMonitorOptions = {},
): {
  deviceClass: DeviceClass;
} {
  const deviceClass = detectDeviceClass();

  useEffect(() => {
    const now = performance.now();

    recordPerformanceMetric({
      name: 'baseline.device-class',
      sceneType: options.sceneType ?? 'browse',
      startedAt: now,
      endedAt: now,
      durationMs: 0,
      metadata: {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
        hardwareConcurrency: navigator.hardwareConcurrency ?? null,
      },
      deviceClass,
    });
  }, [deviceClass, options.sceneType]);

  return { deviceClass };
}
