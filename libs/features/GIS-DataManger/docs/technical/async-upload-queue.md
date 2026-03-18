# 异步上传解析架构 - BullMQ 队列实现

## 问题陈述

大文件上传时，解析和入库过程耗时较长，导致：
1. HTTP 请求超时
2. 前端界面阻塞
3. 用户体验差

## 解决方案

采用 **异步队列处理架构**：
1. 上传请求快速返回 jobId
2. 后台异步解析和入库
3. 前端轮询或订阅进度

## 实现细节

### 关键文件

- `libs/features/GIS-DataManger/api/src/queues/gis.processor.ts` - 队列处理器
- `libs/features/GIS-DataManger/api/src/services/dataset.service.ts` - 数据集服务

### 关键代码

#### 队列定义

```typescript
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';

@Processor('gis-upload')
export class GisUploadProcessor {
  constructor(
    private datasetService: DatasetService,
    private logger: Logger,
  ) {}

  @Process('parse')
  async handleParse(job: Job<{
    filePath: string;
    versionId: string;
    projectId: string;
  }>) {
    const { filePath, versionId, projectId } = job.data;

    try {
      // 1. PARSING
      await this.datasetService.updateStatus(versionId, 'PARSING');
      const result = await this.parseFile(filePath);

      // 2. VALIDATING
      await this.datasetService.updateStatus(versionId, 'VALIDATING');
      const report = await this.validateData(result);

      // 3. IMPORTING
      await this.datasetService.updateStatus(versionId, 'IMPORTING');
      await this.atomicImport(result, versionId);

      // 4. INDEXING
      await this.datasetService.updateStatus(versionId, 'INDEXING');
      await this.buildIndex(versionId);

      // 5. SUCCESS
      await this.datasetService.updateStatus(versionId, 'SUCCESS');

      return { success: true };
    } catch (error) {
      await this.datasetService.updateStatus(versionId, 'FAILED', error.message);
      throw error;
    }
  }
}
```

#### 服务层

```typescript
@Injectable()
export class DatasetService {
  async uploadDataset(
    file: Express.Multer.File,
    projectId: string,
  ): Promise<{ jobId: string; datasetId: string; versionId: string }> {
    // 1. 保存文件到临时目录
    const filePath = await this.saveToTemp(file);

    // 2. 创建 Dataset 和 DatasetVersion
    const dataset = await this.ensureDataset(projectId, file.originalname);
    const version = await this.createVersion(dataset.id, file);

    // 3. 入队
    const job = await this.uploadQueue.add('parse', {
      filePath,
      versionId: version.id,
      projectId,
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });

    return {
      jobId: job.id!,
      datasetId: dataset.id,
      versionId: version.id,
    };
  }

  async getIngestStatus(versionId: string) {
    const version = await this.prisma.datasetVersion.findUnique({
      where: { id: versionId },
      select: { status: true, createdAt: true },
    });

    // 获取队列中的任务进度
    const job = await this.uploadQueue.getJob(versionId);
    const progress = job ? await job.progress() : null;

    return {
      status: version.status,
      progress,
    };
  }
}
```

### 依赖

- 外部库：`@nestjs/bull`, `bull`
- 基础设施：Redis
- 内部依赖：`DatasetService`, `GdalService`

## 边缘情况

| 情况 | 处理方式 |
|------|----------|
| 队列满了 | 配置最大队列长度，拒绝新任务 |
| 任务失败 | 自动重试（3 次），失败后进入死信队列 |
| Redis 宕机 | 降级为同步处理（仅开发环境） |
| 任务超时 | 配置超时时间，超时后终止 |

## 测试要点

- [ ] 上传请求快速返回（<100ms）
- [ ] 后台任务正确执行
- [ ] 失败任务自动重试
- [ ] 进度查询接口返回正确
- [ ] 死信队列记录失败任务

## 配置示例

```typescript
// BullMQ 配置
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: {
    count: 100,  // 保留最近 100 个完成的任务
  },
  removeOnFail: {
    count: 1000, // 保留最近 1000 个失败的任务
  },
}
```

## 参考

- [BullMQ 官方文档](https://docs.bullmq.io/)
- [NestJS Bull 集成](https://docs.nestjs.com/techniques/queues)
