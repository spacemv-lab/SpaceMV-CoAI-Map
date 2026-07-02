/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useEffect, useState } from 'react';
import { LayerState } from '../../../types/map-state';
import { GraduatedConfig, ClassificationMethod } from '../../../types/graduated-style';
import { FieldSelector } from './field-selector';
import { ClassificationSelector } from './classification-selector';
import { ClassesCountControl } from './classes-count-control';
import { ColorRampSelector } from './color-ramp-selector';
import { GraduatedLegendPreview } from './graduated-legend-preview';
import { fetchFieldStats } from '../../../api/field-stats-api';

interface GraduatedColorsPanelProps {
  layer: LayerState;
  config: GraduatedConfig | undefined;
  onChange: (config: GraduatedConfig) => void;
}

/**
 * 前端简单计算等间距断点（fallback 方案，当 API 不可用时）
 */
function calculateEqualIntervalBreakpoints(
  min: number,
  max: number,
  classes: number,
): number[] {
  const step = (max - min) / classes;
  const breakpoints: number[] = [];
  for (let i = 0; i <= classes; i++) {
    breakpoints.push(min + i * step);
  }
  return breakpoints;
}

/**
 * 从 feature 数据获取字段统计（fallback 方案）
 */
function getFieldStatsFromFeatures(
  layer: LayerState,
  field: string,
): { min: number; max: number } | null {
  const features = layer.data?.features;
  if (!features || features.length === 0) return null;

  // 遍历所有 features 获取 min/max
  let min = Infinity;
  let max = -Infinity;

  for (const f of features) {
    const props = f.properties as Record<string, unknown>;
    const value = Number(props[field]);
    if (!isNaN(value) && isFinite(value)) {
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }

  if (min === Infinity || max === -Infinity) return null;
  return { min, max };
}

export function GraduatedColorsPanel({ layer, config, onChange }: GraduatedColorsPanelProps) {
  // 默认配置
  const defaultConfig: GraduatedConfig = {
    field: '',
    method: 'equal-interval',
    classes: 5,
    colorRamp: 'blues',
    breakpoints: [],
    fieldStats: undefined,
  };

  const currentConfig = config || defaultConfig;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // datasetId 用于 API 调用
  const datasetId = layer.sourceId;

  // 当字段/分级方法/类数变化时，调用后端 API 计算统计。
  // 用 cancelled 标志丢弃过期请求：拖动「类数」滑块会快速触发多次，若后 resolve 的旧请求
  // 不丢弃，会把它那次（已过时的）currentConfig 连同旧类数整体写回 store，覆盖用户最新类数，
  // 滑块便在新旧值间反复横跳。
  useEffect(() => {
    if (!currentConfig.field || !datasetId) return;
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    fetchFieldStats(datasetId, {
      field: currentConfig.field,
      method: currentConfig.method,
      classes: currentConfig.classes,
    })
      .then((stats) => {
        if (cancelled) return;
        onChange({
          ...currentConfig,
          fieldStats: {
            min: stats.min,
            max: stats.max,
            mean: stats.mean,
          },
          breakpoints: stats.breakpoints,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[GraduatedColorsPanel] Field stats failed:', err);
        setError(err.message);

        // Fallback: 使用前端估算（仅等间距，且需要本地数据）
        if (currentConfig.method === 'equal-interval') {
          const localStats = getFieldStatsFromFeatures(layer, currentConfig.field);
          if (localStats) {
            const breakpoints = calculateEqualIntervalBreakpoints(
              localStats.min,
              localStats.max,
              currentConfig.classes,
            );
            onChange({
              ...currentConfig,
              fieldStats: localStats,
              breakpoints,
            });
          }
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentConfig.field, currentConfig.method, currentConfig.classes, datasetId]);

  const handleFieldChange = (field: string) => {
    // 切换字段时重置断点
    onChange({
      ...currentConfig,
      field,
      breakpoints: [],
      fieldStats: undefined,
    });
  };

  const handleMethodChange = (method: ClassificationMethod) => {
    // 切换方法时需要重新计算断点
    onChange({
      ...currentConfig,
      method,
      breakpoints: [],
    });
  };

  const handleClassesChange = (classes: number) => {
    onChange({
      ...currentConfig,
      classes,
    });
  };

  const handleColorRampChange = (colorRamp: string) => {
    onChange({
      ...currentConfig,
      colorRamp,
    });
  };

  return (
    <div className="space-y-2">
      {/* Loading indicator */}
      {isLoading && (
        <div className="text-xs text-blue-600 py-1">正在计算统计值...</div>
      )}

      {/* Error indicator */}
      {error && (
        <div className="text-xs text-red-600 py-1">
          统计计算失败（使用本地估算）
        </div>
      )}

      {/* Field selector */}
      <FieldSelector
        layer={layer}
        value={currentConfig.field}
        onChange={handleFieldChange}
      />

      {/* Only show other controls when field is selected */}
      {currentConfig.field && (
        <>
          {/* Classification method */}
          <ClassificationSelector
            value={currentConfig.method}
            onChange={handleMethodChange}
          />

          {/* Classes count */}
          <ClassesCountControl
            value={currentConfig.classes}
            onChange={handleClassesChange}
          />

          {/* Color ramp */}
          <ColorRampSelector
            value={currentConfig.colorRamp}
            onChange={handleColorRampChange}
            classes={currentConfig.classes}
          />

          {/* Legend preview */}
          {currentConfig.breakpoints && currentConfig.breakpoints.length > 0 && (
            <GraduatedLegendPreview config={currentConfig} />
          )}
        </>
      )}
    </div>
  );
}