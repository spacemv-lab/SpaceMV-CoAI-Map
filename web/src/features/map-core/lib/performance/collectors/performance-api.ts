/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * Performance API 采集器
 *
 * 封装浏览器 Performance API：
 * - mark/measure 打点
 * - getResourceTiming 网络请求统计
 */

export class PerformanceCollector {
  private marks: Map<string, number> = new Map();

  /**
   * 打点标记
   */
  mark(name: string): void {
    const timestamp = performance.now();
    this.marks.set(name, timestamp);

    // 写入浏览器 Performance API（DevTools 可查看）
    if (typeof performance.mark === 'function') {
      try {
        performance.mark(name);
      } catch {
        // 某些浏览器限制 mark 名称格式
      }
    }
  }

  /**
   * 计算两个 mark 之间的时间
   */
  measure(name: string, startMark: string, endMark: string): number {
    const start = this.marks.get(startMark);
    const end = this.marks.get(endMark);

    if (!start || !end) {
      console.warn(
        `[PerformanceCollector] Missing marks: ${startMark} or ${endMark}`,
      );
      return 0;
    }

    const duration = end - start;

    // 写入 Performance API
    if (typeof performance.measure === 'function') {
      try {
        performance.measure(name, startMark, endMark);
      } catch {
        // 忽略
      }
    }

    return duration;
  }

  /**
   * 获取网络请求统计（Resource Timing API）
   */
  getResourceTiming(
    urlPattern: string,
  ): { transferSize: number; duration: number } | null {
    const entries = performance.getEntriesByType('resource');
    const matched = entries.find((e) => e.name.includes(urlPattern));

    if (!matched) return null;

    const resourceEntry = matched as PerformanceResourceTiming;
    return {
      transferSize: resourceEntry.transferSize,
      duration: resourceEntry.duration,
    };
  }

  /**
   * 获取所有匹配的 Resource Timing
   */
  getAllResourceTimings(
    urlPattern: string,
  ): Array<{ url: string; transferSize: number; duration: number }> {
    const entries = performance.getEntriesByType('resource');
    const matched = entries.filter((e) => e.name.includes(urlPattern));

    return matched.map((e) => {
      const resourceEntry = e as PerformanceResourceTiming;
      return {
        url: resourceEntry.name,
        transferSize: resourceEntry.transferSize,
        duration: resourceEntry.duration,
      };
    });
  }

  /**
   * 计算多个请求的总传输量
   */
  getTotalTransferSize(urlPattern: string): number {
    const timings = this.getAllResourceTimings(urlPattern);
    return timings.reduce((sum, t) => sum + t.transferSize, 0);
  }

  /**
   * 清理所有 marks
   */
  clear(): void {
    this.marks.clear();

    // 清理 Performance API entries
    if (typeof performance.clearMarks === 'function') {
      performance.clearMarks();
    }
    if (typeof performance.clearMeasures === 'function') {
      performance.clearMeasures();
    }
  }

  /**
   * 获取所有 Performance measures
   */
  getMeasures(): Array<{ name: string; duration: number }> {
    const measures = performance.getEntriesByType('measure');
    return measures.map((m) => ({
      name: m.name,
      duration: m.duration,
    }));
  }
}