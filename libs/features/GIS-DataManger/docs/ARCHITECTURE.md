# GIS-DataManger - 技术架构设计

## 状态

- [ ] 设计中
- [ ] 评审中
- [x] 已确认
- [x] 已实现

## 1. 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                      前端 (React)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ UploadModal │  │ DatasetTable│  │  StorageCard/Stats  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓ REST API
┌─────────────────────────────────────────────────────────────┐
│                   后端 (NestJS)                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Controller  │→ │   Service    │→ │    Adapter       │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│         ↓                ↓                   ↓               │
│    ┌──────────┐   ┌───────────┐      ┌──────────────┐       │
│    │  Prisma  │   │ BullMQ    │      │ GDAL/shpjs   │       │
│    │  Entity  │   │  Queue    │      │  Parser      │       │
│    └──────────┘   └───────────┘      └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   数据存储层                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ PostgreSQL  │  │   PostGIS   │  │   File Storage      │  │
│  │  (元数据)    │  │  (几何数据)  │  │  (Local/MinIO)      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 2. 模块划分

### 2.1 涉及的 Nx 项目

```
libs/features/GIS-DataManger/
├── web/                          # 前端 React 库
│   ├── components/
│   │   ├── upload-modal.tsx
│   │   ├── dataset-table.tsx
│   │   ├── storage-card.tsx
│   │   └── index.ts
│   ├── hooks/
│   │   ├── use-dataset-list.ts
│   │   ├── use-upload.ts
│   │   └── index.ts
│   └── index.ts
│
├── api/                          # 后端 NestJS 库
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── dataset.controller.ts
│   │   │   └── mapping-profile.controller.ts
│   │   ├── services/
│   │   │   ├── dataset.service.ts
│   │   │   ├── gdal.service.ts
│   │   │   └── validation.service.ts
│   │   ├── adapters/
│   │   │   ├── base.adapter.ts
│   │   │   ├── shapefile.adapter.ts
│   │   │   ├── geojson.adapter.ts
│   │   │   └── table.adapter.ts
│   │   ├── queues/
│   │   │   └── gis.processor.ts
│   │   └── gis-data-manger.module.ts
│   └── index.ts
│
└── prisma/                       # Prisma Schema
    └── schema.prisma
```

### 2.2 依赖关系

```
gis-data-manger:web → @nx/react, shared/ui
gis-data-manger:api → @nx/nest, gis-data-manger:prisma
gis-data-manger:api → map-ai-api (运行时依赖)
```

## 3. 数据流

```
用户上传文件
    ↓
[前端] UploadModal 组件
    ↓ (multipart/form-data)
[后端] DatasetController.upload()
    ↓
DatasetService.uploadDataset()
    ↓
保存临时文件 → 创建 DatasetVersion(PENDING) → 返回 jobId
    ↓
入队 BullMQ → VectorProcessor
    ↓
[异步处理]
├─ PARSING: Adapter 解析 (GDAL/shpjs)
├─ VALIDATING: PostGIS 有效性检查
├─ IMPORTING: 原子迁移到业务表
├─ INDEXING: 构建 GIST 索引
└─ SUCCESS/FAILED: 更新状态
    ↓
[前端] 轮询/订阅进度 → 刷新列表
```

## 4. API 设计

### 4.1 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/gis/datasets/upload` | 上传文件 |
| GET | `/api/gis/datasets` | 获取列表（分页） |
| GET | `/api/gis/datasets/:id` | 获取详情 |
| GET | `/api/gis/datasets/:id/geojson` | 获取 GeoJSON |
| GET | `/api/gis/datasets/:id/mvt/:z/:x/:y` | 获取 MVT 切片 |
| DELETE | `/api/gis/datasets/:id` | 删除数据集 |
| GET | `/api/gis/stats/storage` | 获取存储统计 |
| GET | `/api/gis/versions/:id/status` | 获取解析状态 |
| POST | `/api/gis/mappings` | 创建映射模板 |
| GET | `/api/gis/mappings` | 获取映射模板列表 |

### 4.2 数据模型

```typescript
// 核心实体
interface Dataset {
  id: string;
  projectId: string;
  name: string;
  type: GeometryType;  // POINT | LINESTRING | POLYGON | ...
  source: string;      // UPLOAD | SYNC
  tags: string[];
  currentVersionId?: string;
  createdAt: DateTime;
  updatedAt: DateTime;
}

interface DatasetVersion {
  id: string;
  datasetId: string;
  version: number;
  filePath: string;
  fileSize: number;      // 字节
  recordCount: number;   // 要素数量
  sourceCRS?: string;
  bbox?: BBox;
  status: IngestStatus;  // PENDING → PARSING → ... → SUCCESS
  createdAt: DateTime;
}

interface GisFeature {
  id: string;
  versionId: string;
  properties: Json;      // 非几何属性
  geometry: Geometry;    // PostGIS geometry
}

enum IngestStatus {
  PENDING = 'PENDING',
  PARSING = 'PARSING',
  VALIDATING = 'VALIDATING',
  IMPORTING = 'IMPORTING',
  INDEXING = 'INDEXING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}
```

## 5. 状态管理

### 5.1 前端状态

使用 React Query + Zustand：

```typescript
// 数据集列表查询
const { data, isLoading, refetch } = useQuery({
  queryKey: ['datasets', { projectId, page, pageSize }],
  queryFn: () => datasetApi.list({ projectId, page, pageSize }),
});

// 上传进度订阅
const { progress, status } = useIngestStatus(jobId);
```

### 5.2 后端状态

NestJS 服务生命周期：

```typescript
@Injectable()
export class GdalService implements OnModuleInit {
  private available: boolean | null = null;

  async onModuleInit() {
    await this.ensureInitialized();
  }

  async isAvailable(): Promise<boolean> {
    await this.ensureInitialized();
    return this.available ?? false;
  }
}
```

## 6. 技术决策记录

### 决策 1: GDAL vs shpjs 解析方案

- **背景**：Shapefile 解析在 Node.js 环境下报错 `self is not defined`
- **选项**：
  - A. shpjs（纯 JS，浏览器优先）
  - B. GDAL ogr2ogr（C++，工业级工具）
  - C. 混合方案
- **决策**：采用 C. 混合方案，优先 GDAL，降级到 shpjs
- **影响**：
  - 生产环境需安装 GDAL
  - 开发环境无 GDAL 也可运行
  - 代码复杂度增加但容错性更好

### 决策 2: 异步队列处理

- **背景**：大文件上传阻塞接口，用户体验差
- **决策**：使用 BullMQ 异步队列
- **影响**：
  - 需要 Redis 支持
  - 支持重试、超时、死信
  - 前端需轮询或 WebSocket 订阅进度

### 决策 3: 原子迁移策略

- **背景**：数据入库过程中失败导致数据不一致
- **决策**：使用 PostgreSQL 事务 + `INSERT ... SELECT`
- **影响**：
  - 保证数据一致性
  - 失败自动回滚
  - 临时表需清理

## 7. 核心流程实现

### 7.1 上传解析流程

```typescript
// 1. 文件接收（同步）
async upload(file: Express.Multer.File, projectId: string) {
  const filePath = await this.saveToTemp(file);
  const version = await this.createVersion(file, projectId);
  const jobId = await this.queue.enqueue({
    type: 'PARSE',
    filePath,
    versionId: version.id,
  });
  return { jobId, datasetId: version.datasetId, versionId: version.id };
}

// 2. 异步解析（BullMQ Processor）
async process(job: Job) {
  const { filePath, versionId } = job.data;

  // PARSING
  await this.updateStatus(versionId, 'PARSING');
  const result = await this.adapter.parse(filePath);

  // VALIDATING
  await this.updateStatus(versionId, 'VALIDATING');
  const report = await this.validator.validate(result);

  // IMPORTING
  await this.updateStatus(versionId, 'IMPORTING');
  await this.importer.atomicImport(result, versionId);

  // INDEXING
  await this.updateStatus(versionId, 'INDEXING');
  await this.indexer.buildGistIndex(versionId);

  // SUCCESS
  await this.updateStatus(versionId, 'SUCCESS');
}
```

### 7.2 适配器模式

```typescript
@Injectable()
export class ShapefileAdapter extends BaseAdapter {
  constructor(private gdalService: GdalService) {
    super();
  }

  async parse(filePath: string | Buffer): Promise<ParseResult> {
    const path = await this.normalizeInput(filePath);

    // 优先 GDAL
    if (await this.gdalService.isAvailable()) {
      try {
        return await this.parseWithGdal(path);
      } catch (e) {
        this.logger.warn(`GDAL failed, fallback to shpjs: ${e.message}`);
      }
    }

    // 降级 shpjs
    return this.parseWithShpjs(path);
  }
}
```

## 8. 更新日志

| 日期 | 变更内容 |
|------|----------|
| 2026-02-11 | 初始架构设计 |
| 2026-02-26 | 添加 GDAL 混合解析方案 |
| 2026-02-26 | 添加异步队列和原子迁移设计 |
