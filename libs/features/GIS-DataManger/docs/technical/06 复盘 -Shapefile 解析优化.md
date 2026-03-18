# GIS-DataManger Shapefile 解析优化复盘

> 本文档记录了一次完整的 GIS 数据上传解析功能优化过程，涵盖问题排查、技术选型、架构设计、代码实现等环节。适合初级前端工程师学习参考。

---

## 一、项目背景

### 1.1 业务场景

GIS-DataManger 是一个地理信息数据管理平台，核心功能包括：
- 上传 GIS 数据文件（GeoJSON、Shapefile、KML、CSV 等）
- 解析并存储地理要素数据
- 在地图上可视化展示
- 提供矢量切片（MVT）服务

### 1.2 问题描述

用户上传 Shapefile（.zip 格式）时频繁报错：
```
ReferenceError: self is not defined
    at shpjs/dist/shp.js:7369:27
```

导致 Shapefile 解析失败，数据无法入库。

---

## 二、问题排查过程

### 2.1 第一步：定位错误来源

**错误堆栈分析：**
```
ReferenceError: self is not defined
  at file:///node_modules/.pnpm/shpjs@6.2.0/node_modules/shpjs/dist/shp.js:7369:27
  at ModuleJobSync.runSync (node:internal/modules/esm/module_job:534:37)
```

**关键发现：**
1. 错误发生在 `shpjs` 库中
2. `self` 是浏览器环境的全局对象
3. 当前运行环境是 Node.js（服务端），不存在 `self`

**初步结论：** `shpjs` 是为浏览器设计的库，在 Node.js 环境存在兼容性问题。

### 2.2 第二步：追溯代码实现

查看 `shapefile.adapter.ts` 源码：

```typescript
// Polyfill self for shpjs (required in Node.js environment)
if (typeof global.self === 'undefined') {
  (global as any).self = global;
}

const shpjs = require('shpjs');
```

**代码分析：**
- 开发者已经意识到需要 `self` polyfill
- 但这种「打补丁」的方式说明库本身对 Node.js 支持不完善

### 2.3 第三步：查阅架构文档

在 `04 架构.md` 中发现：

> **工业级上传解析架构**
> - 使用 GDAL ogr2ogr 进行格式转换
> - 支持 /vsizip/ 虚拟路径直接读取压缩包
> - 统一投影转换为 EPSG:4326

**结论：** 当前实现与架构设计不符，应该使用 GDAL 而非 shpjs。

---

## 三、技术选型分析

### 3.1 方案对比

| 方案 | shpjs | GDAL ogr2ogr |
|------|-------|--------------|
| 类型 | 纯 JavaScript | C++ 原生工具 |
| 设计目标 | 浏览器端 | 专业 GIS 工具 |
| Node.js 支持 | ❌ 需要 polyfill | ✅ 原生支持 |
| 坐标转换 | ❌ 有限 | ✅ 完整支持 |
| 编码处理 | ❌ DBF 编码问题 | ✅ 支持多种编码 |
| 性能 | ⚠️ 大文件慢 | ✅ 工业级性能 |
| 依赖 | ✅ 无系统依赖 | ❌ 需安装 GDAL |

### 3.2 决策：混合方案

考虑到开发环境和生产环境的差异，采用**混合方案**：

```
┌─────────────────────────────────────┐
│         ShapefileAdapter.parse()    │
├─────────────────────────────────────┤
│  1. 检查 GDAL 是否可用？             │
│     ├─ 是 → 使用 ogr2ogr 解析        │
│     └─ 否 → 降级到 shpjs 解析        │
│  2. 返回统一的 ParseResult 格式      │
└─────────────────────────────────────┘
```

**优势：**
- 开发环境没有 GDAL 也能运行
- 生产环境可以无缝切换到高级模式
- 代码具备良好的容错性

---

## 四、核心实现

### 4.1 目录结构

```
libs/features/GIS-DataManger/api/src/
├── adapters/
│   ├── base.adapter.ts          # 基础适配器接口
│   ├── shapefile.adapter.ts     # Shapefile 适配器（重构）
│   ├── geojson.adapter.ts       # GeoJSON 适配器
│   ├── kml.adapter.ts           # KML 适配器
│   └── table.adapter.ts         # 表格数据适配器
├── utils/
│   └── gdal.service.ts          # GDAL 服务（新增）
├── lib/
│   ├── dataset.service.ts       # 数据集服务
│   ├── dataset.controller.ts    # 数据集控制器
│   └── gis-data-manger-api.module.ts
└── queues/
    └── gis.processor.ts         # GIS 处理队列
```

### 4.2 关键代码解析

#### 4.2.1 GdalService - GDAL 工具类

```typescript
@Injectable()
export class GdalService {
  private available: boolean | null = null;  // null 表示未检查
  private initPromise?: Promise<boolean>;

  async onModuleInit() {
    await this.ensureInitialized();
  }

  // 异步检查 GDAL 可用性
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
      // ... 解析版本信息
      this.available = true;
      return true;
    } catch (error) {
      this.available = false;
      return false;
    }
  }
}
```

**设计要点：**
1. 使用 `null` 区分「未检查」和「不可用」两种状态
2. 用 `initPromise` 避免重复初始化
3. `ensureInitialized()` 确保异步初始化完成

#### 4.2.2 ShapefileAdapter - 适配器模式

```typescript
@Injectable()
export class ShapefileAdapter extends BaseAdapter {
  constructor(private gdalService: GdalService) {
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
    // 使用 GDAL 的 /vsizip/ 虚拟路径
    const result = await this.gdalService.convertToGeoJSON(filePath, {
      targetCRS: 'EPSG:4326',
    });

    // 读取转换后的 GeoJSON
    const geojson = JSON.parse(await fs.readFile(result.outputPath, 'utf-8'));

    return this.parseGeoJSONResult(geojson);
  }
}
```

**核心技巧：**
- `/vsizip/` 虚拟路径：直接读取 zip 文件，无需解压
```typescript
const vsizipPath = `/vsizip/${path.resolve(filePath)}`;
const command = `ogr2ogr -f "GeoJSON" -t_srs EPSG:4326 "${output}" "${vsizipPath}"`;
```

#### 4.2.3 模块注册 - 依赖注入

```typescript
@Global()
@Module({
  providers: [
    GdalService,           // 全局服务
    DatasetService,
    ShapefileAdapter,      // 依赖 GdalService
    // ... 其他服务
  ],
})
export class GisDataMangerApiModule {}
```

**为什么用 `@Global()`？**
- GdalService 被多个服务依赖
- 避免在每个模块中重复注册

---

## 五、踩坑记录与解决方案

### 5.1 坑 1：初始化时序问题

**现象：** 服务启动后，GDAL 始终不生效，一直走 shpjs 降级方案。

**原因分析：**
```typescript
// ❌ 错误写法
export class ShapefileAdapter {
  private gdalAvailable = false;

  constructor(private gdalService: GdalService) {
    this.gdalAvailable = gdalService.isAvailable();  // 此时 GdalService 还未初始化
  }
}
```

NestJS 的 `onModuleInit` 是异步的，构造函数执行时 `GdalService` 的 `available` 还是初始值 `false`。

**解决方案：**
```typescript
// ✅ 正确写法
async parse() {
  const gdalAvailable = await this.gdalService.isAvailable();
  if (gdalAvailable) {
    // ...
  }
}
```

**经验教训：**
- NestJS 服务 lifecycle：构造函数 → onModuleInit → onModuleDestroy
- 不要在构造函数中依赖其他服务的初始化状态
- 异步初始化要考虑到调用时机

### 5.2 坑 2：数据集创建逻辑错误

**现象：** 上传成功后，`/api/datasets` 接口返回的数据中找不到新上传的数据集。

**原因分析：**
```typescript
// ❌ 错误代码
if (!dataset) {
  // 创建的是 Project，不是 Dataset！
  await this.datasetService.createProject({
    name: name || file.originalname,
    ownerId: projectId,
  });

  // 从列表获取（实际获取的是旧数据）
  const result = await this.datasetService.listDatasets({ ... });
  dataset = result.items[0];
}
```

**问题：** `createProject` 创建的是项目，不是数据集。新数据集根本没有被创建！

**解决方案：**
```typescript
// ✅ 正确代码
if (!dataset) {
  // 1. 确保项目存在
  let project = await this.datasetService.getProject(projectId);
  if (!project) {
    project = await this.datasetService.createProject({ ... });
  }

  // 2. 创建数据集
  const newDataset = await this.datasetService.createDataset({
    projectId,
    name: name || file.originalname,
  });

  // 3. 获取完整数据（包含关联数据）
  dataset = await this.datasetService.getDataset(newDataset.id);
}
```

**经验教训：**
- 仔细区分业务概念（Project vs Dataset）
- 创建资源后立即获取完整对象，避免缓存不一致
- 接口设计要明确（增加 `createDataset` 方法）

### 5.3 坑 3：TypeScript 类型不匹配

**现象：** 编译报错
```
Type 'Dataset' is not assignable to type 'DatasetWithVersions'
```

**原因：** `createDataset` 返回的是 `Dataset` 基础类型，但后续代码需要包含关联数据的类型。

**解决方案：** 调用 `getDataset(id)` 获取完整数据。

**经验教训：**
- Prisma 的 include 查询会改变返回类型
- 创建资源后如需关联数据，单独查询更可靠

---

## 六、GIS 专业知识补充

### 6.1 常见 GIS 文件格式

| 格式 | 说明 | 特点 |
|------|------|------|
| GeoJSON | 基于 JSON 的开放标准 | 易读、Web 友好 |
| Shapefile | ESRI 开发的矢量格式 | 工业标准、需多个文件 |
| KML/KMZ | Google Earth 格式 | 支持 3D、时间序列 |
| CSV | 表格数据 | 需指定坐标列 |

### 6.2 Shapefile 的组成

一个完整的 Shapefile 包含：
- `.shp` - 几何数据
- `.shx` - 索引数据
- `.dbf` - 属性数据

**为什么打包成 .zip？**
- 单个文件便于传输
- 保持文件完整性

### 6.3 坐标系（CRS）

- **EPSG:4326** = WGS84 = GPS 使用的坐标系（经纬度）
- **EPSG:3857** = Web Mercator = Google/百度地图使用的投影

**为什么要统一转换到 EPSG:4326？**
- 不同数据源可能使用不同坐标系
- 统一坐标系便于后续处理和展示
- WGS84 是国际通用标准

---

## 七、验证与测试

### 7.1 环境验证

```bash
# 检查 GDAL 安装
ogr2ogr --version

# 测试 /vsizip/ 功能
ogr2ogr -f "GeoJSON" -t_srs EPSG:4326 output.geojson /vsizip/test.zip
```

### 7.2 功能测试清单

| 测试项 | 预期结果 |
|--------|----------|
| 上传 GeoJSON | ✅ 解析成功，返回 datasetId |
| 上传 Shapefile (.zip) | ✅ 使用 GDAL 解析，中文属性正常 |
| 上传大型文件 | ✅ 异步处理，不阻塞请求 |
| 查看数据集列表 | ✅ 新数据集出现在列表首位 |
| 获取 GeoJSON | ✅ 返回正确的要素数据 |

---

## 八、经验总结

### 8.1 给初级前端工程师的建议

#### 技术选型
1. **优先选择工业级方案**：shpjs 能用但不够稳定，GDAL 是专业 GIS 工具
2. **考虑降级方案**：不是所有环境都有 GDAL，要有 fallback
3. **查阅架构文档**：避免重复造轮子或走弯路

#### 问题排查
1. **读懂错误堆栈**：从堆栈中定位库名、文件名、行号
2. **理解运行环境**：浏览器 vs Node.js 的全局对象不同
3. **查看源码**：不要只依赖文档，源码最真实

#### 代码设计
1. **异步初始化要小心**：考虑调用时机和依赖关系
2. **依赖注入是双刃剑**：方便测试但要注意生命周期
3. **错误处理要完善**：记录日志并提供降级方案

#### 业务理解
1. **区分核心概念**：Project ≠ Dataset ≠ Version
2. **理解数据流向**：上传 → 解析 → 存储 → 查询
3. **了解领域知识**：GIS 坐标系、文件格式等

### 8.2 设计模式应用

本次开发用到的设计模式：

| 模式 | 应用场景 |
|------|----------|
| 适配器模式 | 统一不同格式的解析接口 |
| 策略模式 | GDAL/shpjs 动态切换 |
| 依赖注入 | NestJS 服务管理 |
| 工厂模式 | GdalService 创建临时文件 |

### 8.3 最佳实践

```typescript
// ✅ 好的实践

// 1. 类型安全
interface ParseResult {
  features: ParsedFeature[];
  geometryType: string;
  recordCount: number;
}

// 2. 错误处理
try {
  return await this.parseWithGdal(filePath);
} catch (error) {
  this.logger.warn(`GDAL 失败: ${error.message}`);
  // 降级处理
}

// 3. 资源清理
async parse() {
  const tempPath = await this.createTempFile();
  try {
    // 处理逻辑
  } finally {
    await this.cleanup(tempPath);  // 确保清理
  }
}
```

---

## 九、后续优化方向

1. **性能优化**
   - 大文件分块处理
   - 并发解析多个图层
   - 添加进度回调

2. **功能增强**
   - 支持更多坐标系
   - CSV 列自动识别
   - 数据质量校验

3. **监控告警**
   - 解析失败率统计
   - 处理时长监控
   - 异常告警通知

---

## 十、参考资源

- [GDAL 官方文档](https://gdal.org/)
- [OGR 工具使用指南](https://gdal.org/programs/ogr2ogr.html)
- [NestJS 生命周期](https://docs.nestjs.com/techniques/lifecycle-events)
- [PostGIS 空间数据库](https://postgis.net/)

---

**文档版本：** 1.0
**更新日期：** 2026-02-26
**作者：** GIS-DataManger Team
