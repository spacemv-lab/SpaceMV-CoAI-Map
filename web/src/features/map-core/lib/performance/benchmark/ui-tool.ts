/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 基准测试 UI 工具
 *
 * 提供：
 * - 测试页面 UI 控件
 * - 渲染器切换
 * - 图层加载/清理回调注入
 */

import { BenchmarkRunner, BenchmarkConfig } from './runner';
import { generateMarkdownReport } from '../reporters/markdown-reporter';
import { useMapStore } from '../../store/use-map-store';
import { createLayerFromDataset } from '../../runtime/layer-routing';

export interface BenchmarkTestOptions {
  datasetId: string;
  iterations?: number;
  warmupRuns?: number;
}

/**
 * 运行基准测试的便捷函数
 */
export async function runBenchmarkTest(options: BenchmarkTestOptions): Promise<string> {
  const config: BenchmarkConfig = {
    datasetId: options.datasetId,
    iterations: options.iterations || 3,
    warmupRuns: options.warmupRuns || 1,
    fpsDurationMs: 3000,
  };

  // 注入回调函数
  injectBenchmarkCallbacks();

  const runner = new BenchmarkRunner();
  const { cesium, maplibre } = await runner.runComparison(config);

  // 生成 Markdown 报告
  const report = generateMarkdownReport(cesium, maplibre);

  // 输出到 console
  console.log('\n' + report);

  // 可选：复制到剪贴板
  try {
    await navigator.clipboard.writeText(report);
    console.log('[Benchmark] 报告已复制到剪贴板');
  } catch {
    // 忽略
  }

  return report;
}

/**
 * 注入渲染器回调函数
 */
function injectBenchmarkCallbacks(): void {
  (window as unknown as {
    BENCHMARK_LOAD_LAYER: (datasetId: string, renderer: string) => Promise<number>;
  }).BENCHMARK_LOAD_LAYER = async (datasetId: string, renderer: string) => {
    const store = useMapStore.getState();

    // 切换渲染器
    store.setExperimental({ useMaplibre: renderer === 'maplibre' });

    // 等待渲染器就绪
    await waitForViewerReady();

    // 获取数据集信息
    const dataset = await fetch(`/api/datasets/${datasetId}`).then((r) => r.json());

    // 创建并添加图层到 store（触发渲染器同步）
    const layer = createLayerFromDataset(dataset, 'browse');
    console.log(`[Benchmark] Created layer: id=${layer.id}, name=${layer.name}, sourceId=${layer.sourceId}`);
    store.addLayer(layer);

    // 等待图层真正渲染完成（Cesium: 数据下载+解析+实体添加 / MapLibre: source+layer 注册）
    await waitForLayerLoaded(layer.id);

    return dataset.currentVersion?.recordCount || 0;
  };

  (window as unknown as {
    BENCHMARK_CLEAR_LAYER: (renderer: string) => Promise<void>;
  }).BENCHMARK_CLEAR_LAYER = async (renderer: string) => {
    const store = useMapStore.getState();

    // Clear Cesium DataSources
    const cesiumViewer = (
      window as unknown as {
        CESIUM_VIEWER?: {
          dataSources: { length: number; get: (index: number) => { name?: string }; remove: (ds: { name?: string }) => boolean };
        };
      }
    ).CESIUM_VIEWER;

    if (cesiumViewer) {
      console.log(`[Benchmark Clear] Before: ${cesiumViewer.dataSources.length} DataSources`);
      for (let i = 0; i < cesiumViewer.dataSources.length; i++) {
        const ds = cesiumViewer.dataSources.get(i);
        console.log(`  [${i}] name=${ds?.name || '(none)'}`);
      }

      // Remove all DataSources by iterating backwards
      while (cesiumViewer.dataSources.length > 0) {
        const ds = cesiumViewer.dataSources.get(0);
        if (ds) {
          cesiumViewer.dataSources.remove(ds);
        } else {
          break;
        }
      }
      console.log(`[Benchmark Clear] After: ${cesiumViewer.dataSources.length} DataSources`);
    }

    // Clear store layers
    for (const layer of store.layers) {
      store.removeLayer(layer.id);
    }

    // Clear MapLibre sources/layers (keep tianditu basemap)
    const mlMap = (window as unknown as {
      MAPLIBRE_MAP?: {
        getSource: (id: string) => unknown;
        removeSource: (id: string) => void;
        getLayer: (id: string) => unknown;
        removeLayer: (id: string) => void;
        style: { getSourceIds?: () => string[]; getLayers?: () => { id: string }[] };
      };
    }).MAPLIBRE_MAP;
    if (mlMap?.style) {
      const layerIds = mlMap.style.getLayers?.().map((l: { id: string }) => l.id) || [];
      for (const id of layerIds) {
        try { mlMap.removeLayer(id); } catch {}
      }
      const sourceIds = mlMap.style.getSourceIds?.() || [];
      for (const id of sourceIds) {
        if (id !== 'tianditu') {
          try { mlMap.removeSource(id); } catch {}
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  };

  (window as unknown as {
    BENCHMARK_INTERACT: (durationMs: number) => Promise<void>;
  }).BENCHMARK_INTERACT = async (durationMs: number) => {
    // 模拟缩放交互
    const store = useMapStore.getState();
    const startTime = Date.now();
    const interval = 100;

    while (Date.now() - startTime < durationMs) {
      // 模拟缩放
      const currentZoom = store.viewport.zoom;
      const delta = Math.sin((Date.now() - startTime) / 500) * 1000;
      store.setViewport({
        ...store.viewport,
        zoom: currentZoom + delta,
      });
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  };
}

/**
 * 等待渲染器就绪
 */
function waitForViewerReady(): Promise<void> {
  return new Promise((resolve) => {
    // 先等待 store.viewerReady 为 true
    const checkStore = setInterval(() => {
      if (useMapStore.getState().viewerReady) {
        clearInterval(checkStore);

        // store 说 ready 了，再检查实际 viewer 实例是否存在
        const cesiumViewer = (
          window as unknown as { CESIUM_VIEWER?: object }
        ).CESIUM_VIEWER;
        const mlMap = (window as unknown as { MAPLIBRE_MAP?: object })
          .MAPLIBRE_MAP;

        if (cesiumViewer || mlMap) {
          resolve();
          return;
        }

        // viewer 还没实例化，继续等
        const checkInstance = setInterval(() => {
          const c = (window as unknown as { CESIUM_VIEWER?: object })
            .CESIUM_VIEWER;
          const m = (window as unknown as { MAPLIBRE_MAP?: object })
            .MAPLIBRE_MAP;
          if (c || m) {
            clearInterval(checkInstance);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInstance);
          resolve();
        }, 10000);
      }
    }, 100);

    // 超时保护
    setTimeout(() => {
      clearInterval(checkStore);
      resolve();
    }, 15000);
  });
}

/**
 * 等待图层真正渲染完成
 *
 * 监听渲染器发出的 map:layer-loaded 事件（在 waitForStableFrame() 完成后触发）
 * 如果事件不可用，回退到轮询检测
 */
function waitForLayerLoaded(layerId: string, timeoutMs = 30000): Promise<void> {
  return new Promise((resolve) => {
    // 方式 1: 监听自定义事件（精确，来自 layer-renderer.tsx 的 waitForStableFrame 之后）
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.layerId === layerId) {
        window.removeEventListener('map:layer-loaded', handler);
        clearTimeout(timer);
        resolve();
      }
    };
    window.addEventListener('map:layer-loaded', handler);

    // 方式 2: 轮询回退（MapLibre 或事件不可用时）
    const timer = setTimeout(() => {
      window.removeEventListener('map:layer-loaded', handler);
      startPollingFallback();
    }, 5000);

    function startPollingFallback(): void {
      const startTime = Date.now();
      const poll = setInterval(() => {
        if (Date.now() - startTime > timeoutMs) {
          clearInterval(poll);
          console.warn(
            `[Benchmark] Layer ${layerId} not fully loaded after ${timeoutMs}ms`,
          );
          resolve();
          return;
        }

        // MapLibre
        const mlMap = (window as unknown as { MAPLIBRE_MAP?: { getLayer: (id: string) => unknown; getSource: (id: string) => unknown } })
          .MAPLIBRE_MAP;
        if (mlMap && (mlMap.getLayer(layerId) || mlMap.getSource(layerId))) {
          clearInterval(poll);
          resolve();
          return;
        }

        // Cesium DataSource
        const cesiumViewer = (
          window as unknown as {
            CESIUM_VIEWER?: {
              dataSources: { length: number; get: (index: number) => { name?: string } };
            };
          }
        ).CESIUM_VIEWER;
        if (cesiumViewer) {
          for (let i = 0; i < cesiumViewer.dataSources.length; i++) {
            const ds = cesiumViewer.dataSources.get(i);
            if (ds?.name === layerId) {
              clearInterval(poll);
              resolve();
              return;
            }
          }
        }
      }, 200);
    }
  });
}

// 暴露到全局，供手动调用
(window as unknown as { runBenchmarkTest: typeof runBenchmarkTest }).runBenchmarkTest =
  runBenchmarkTest;