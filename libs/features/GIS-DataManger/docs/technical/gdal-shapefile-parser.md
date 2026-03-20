# Shapefile 解析优化 - GDAL 混合方案实现

## 问题陈述

用户上传 Shapefile（.zip 格式）时频繁报错：
```
ReferenceError: self is not defined
    at shpjs/dist/shp.js:7369:27
```

导致 Shapefile 解析失败，数据无法入库。

**根本原因**：`shpjs` 是为浏览器环境设计的库，依赖 `self` 全局对象，在 Node.js 环境下存在兼容性问题。

## 解决方案

采用 **GDAL/shpjs 混合方案**：
1. 优先使用 GDAL ogr2ogr 进行工业级解析
2. GDAL 不可用时降级到 shpjs
3. 保持统一的 ParseResult 返回格式

## 实现细节

### 关键文件

- `libs/features/GIS-DataManger/api/src/utils/gdal.service.ts` - GDAL 服务
- `libs/features/GIS-DataManger/api/src/adapters/shapefile.adapter.ts` - Shapefile 适配器
- `libs/features/GIS-DataManger/api/src/adapters/base.adapter.ts` - 基础适配器接口

### 关键代码

#### GdalService - GDAL 工具类

```typescript
@Injectable()
export class GdalService implements OnModuleInit {
  private available: boolean | null = null;
  private initPromise?: Promise<boolean>;

  async onModuleInit() {
    await this.ensureInitialized();
  }

  async isAvailable(): Promise<boolean> {
    await this.ensureInitialized();
    return this.available ?? false;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.available === null && !this.initPromise) {
      this.initPromise = this.checkAvailability();
    }
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  private async checkAvailability(): Promise<boolean> {
    try {
      const result = await execAsync('ogr2ogr --version');
      this.available = true;
      return true;
    } catch (error) {
      this.available = false;
      return false;
    }
  }

  async convertToGeoJSON(inputPath: string, options: { targetCRS?: string } = {}) {
    const output = `/tmp/${uuid()}.geojson`;
    const vsizipPath = `/vsizip/${path.resolve(inputPath)}`;

    const command = `ogr2ogr -f "GeoJSON" "${output}" "${vsizipPath}"`;

    if (options.targetCRS) {
      command += ` -t_srs ${options.targetCRS}`;
    }

    await execAsync(command);

    return { outputPath: output };
  }
}
```

#### ShapefileAdapter - 适配器模式

```typescript
@Injectable()
export class ShapefileAdapter extends BaseAdapter {
  constructor(
    private gdalService: GdalService,
    private logger: Logger,
  ) {
    super();
  }

  async parse(filePathOrBuffer: string | Buffer): Promise<ParseResult> {
    // 1. 处理 Buffer 输入
    const filePath = Buffer.isBuffer(filePathOrBuffer)
      ? await this.saveBufferToTemp(filePathOrBuffer)
      : filePathOrBuffer;

    // 2. 优先尝试 GDAL
    const gdalAvailable = await this.gdalService.isAvailable();
    if (gdalAvailable) {
      try {
        return await this.parseWithGdal(filePath);
      } catch (error) {
        this.logger.warn(`GDAL 失败，降级到 shpjs: ${error.message}`);
      }
    }

    // 3. 降级到 shpjs
    return this.parseWithShpjs(filePath);
  }

  private async parseWithGdal(filePath: string): Promise<ParseResult> {
    const result = await this.gdalService.convertToGeoJSON(filePath, {
      targetCRS: 'EPSG:4326',
    });

    const geojson = JSON.parse(await fs.readFile(result.outputPath, 'utf-8'));
    return this.parseGeoJSONResult(geojson);
  }

  private async parseWithShpjs(filePath: string): Promise<ParseResult> {
    // Polyfill self for shpjs
    if (typeof global.self === 'undefined') {
      (global as any).self = global;
    }

    const shpjs = require('shpjs');
    const buffer = await fs.readFile(filePath);
    const geojson = await shpjs(buffer);
    return this.parseGeoJSONResult(geojson);
  }
}
```

### 依赖

- 外部库：`shpjs@6.2.0`
- 系统依赖：`gdal-bin`（可选，生产环境推荐安装）
- 内部依赖：`GdalService`, `BaseAdapter`

## 边缘情况

| 情况 | 处理方式 |
|------|----------|
| GDAL 未安装 | 自动降级到 shpjs |
| Shapefile 无 .prj 文件 | 强制用户指定源 CRS |
| 中文属性编码错误 | GDAL 自动处理，shpjs 可能失败 |
| 大文件（>100MB） | 异步队列处理 |
| Buffer 输入 | 保存到临时文件后解析 |

## 测试要点

- [ ] GDAL 可用时，使用 GDAL 解析
- [ ] GDAL 不可用时，降级到 shpjs
- [ ] Shapefile zip 包解析成功
- [ ] 中文属性正常显示
- [ ] 坐标转换为 EPSG:4326
- [ ] Buffer 输入处理正确
- [ ] 临时文件正确清理

## 性能对比

| 指标 | shpjs | GDAL |
|------|-------|------|
| 1MB 文件解析 | ~500ms | ~100ms |
| 10MB 文件解析 | ~5s | ~500ms |
| 中文属性支持 | ❌ | ✅ |
| 坐标转换 | 有限 | ✅ 完整 |

## 参考

- [GDAL 官方文档](https://gdal.org/)
- [OGR 工具使用指南](https://gdal.org/programs/ogr2ogr.html)
- [06 复盘 -Shapefile 解析优化.md](../06 复盘 -Shapefile 解析优化.md)
