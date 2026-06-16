/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * Memory 采样器
 *
 * 定时采样 JS Heap 内存
 * - 仅 Chrome 支持 performance.memory API
 * - 其他浏览器返回空数据
 */

export interface MemoryStats {
  peak: number;
  avg: number;
  min: number;
  samples: number;
  supported: boolean;
}

export class MemoryCollector {
  private samples: number[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private supported: boolean = false;

  constructor() {
    // 检测 Chrome Memory API 可用性
    this.supported =
      'memory' in performance &&
      performance.memory !== null &&
      typeof performance.memory === 'object' &&
      'usedJSHeapSize' in (performance.memory as object);
  }

  /**
   * 检查是否支持内存采集
   */
  isSupported(): boolean {
    return this.supported;
  }

  /**
   * 开始采样
   */
  start(intervalMs: number = 500): void {
    this.samples = [];

    if (!this.supported) {
      console.warn(
        '[MemoryCollector] performance.memory API not supported (Chrome only)',
      );
      return;
    }

    this.intervalId = setInterval(() => {
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      if (mem) {
        this.samples.push(mem.usedJSHeapSize);
      }
    }, intervalMs);
  }

  /**
   * 停止采样并返回结果
   */
  stop(): MemoryStats {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (!this.supported || this.samples.length === 0) {
      return {
        peak: 0,
        avg: 0,
        min: 0,
        samples: 0,
        supported: this.supported,
      };
    }

    const sum = this.samples.reduce((a, b) => a + b, 0);

    return {
      peak: Math.max(...this.samples),
      avg: sum / this.samples.length,
      min: Math.min(...this.samples),
      samples: this.samples.length,
      supported: true,
    };
  }

  /**
   * 获取当前内存使用
   */
  getCurrentMemory(): number {
    if (!this.supported) return 0;

    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return mem?.usedJSHeapSize ?? 0;
  }

  /**
   * 清理数据
   */
  clear(): void {
    this.samples = [];
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * 获取采样历史
   */
  getSamples(): number[] {
    return [...this.samples];
  }
}