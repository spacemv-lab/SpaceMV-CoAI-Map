/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatasetService } from './dataset.service';

/**
 * DatasetService 字段 schema / 要素属性相关方法的单测。
 * DatasetService 继承 PrismaClient，用 Object.create(prototype) 拿到真实方法、
 * 再注入 mock 的 Prisma 委托（datasetField / dataset / $transaction / $executeRaw），
 * 不连真实库。raw SQL(jsonb 操作)的正确性需集成测试覆盖，这里只验控制流与异常。
 */
function createService() {
  const datasetField = {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const dataset = { findUnique: jest.fn() };
  const execRaw = jest.fn().mockResolvedValue(1);
  const txMock = { datasetField, dataset, $executeRaw: execRaw };

  const service = Object.create(DatasetService.prototype) as DatasetService;
  Object.assign(service, {
    datasetField,
    dataset,
    $executeRaw: execRaw,
    $transaction: jest.fn(async (cb: (tx: typeof txMock) => Promise<unknown>) =>
      cb(txMock),
    ),
  });
  return { service, datasetField, dataset, execRaw };
}

describe('DatasetService field & properties', () => {
  describe('updateFeatureProperties', () => {
    it('updates properties and returns affected count', async () => {
      const { service, dataset } = createService();
      dataset.findUnique.mockResolvedValue({ currentVersionId: 'ver-1' });

      const res = await service.updateFeatureProperties('ds-1', 'f-1', { a: 1 });

      expect(res).toEqual({ success: true, affected: 1 });
    });

    it('throws 404 when the feature is not found (0 rows)', async () => {
      const { service, dataset, execRaw } = createService();
      dataset.findUnique.mockResolvedValue({ currentVersionId: 'ver-1' });
      execRaw.mockResolvedValue(0);

      await expect(
        service.updateFeatureProperties('ds-1', 'missing', { a: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 404 when the dataset has no current version', async () => {
      const { service, dataset } = createService();
      dataset.findUnique.mockResolvedValue({ currentVersionId: null });

      await expect(
        service.updateFeatureProperties('ds-1', 'f-1', { a: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('addDatasetField', () => {
    it('creates the field and backfills default value into features', async () => {
      const { service, datasetField, dataset } = createService();
      dataset.findUnique.mockResolvedValue({ currentVersionId: 'ver-1' });

      const res = await service.addDatasetField('ds-1', {
        name: 'score',
        alias: '分数',
        type: 'number',
      });

      expect(datasetField.create).toHaveBeenCalledWith({
        data: {
          datasetId: 'ds-1',
          name: 'score',
          alias: '分数',
          type: 'number',
          nullable: true,
        },
      });
      expect(res).toEqual({ datasetId: 'ds-1', name: 'score' });
    });

    it('throws 400 when name is empty', async () => {
      const { service } = createService();
      await expect(
        service.addDatasetField('ds-1', { name: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws 400 when the field already exists (unique violation)', async () => {
      const { service, datasetField } = createService();
      datasetField.create.mockRejectedValue(new Error('unique constraint'));

      await expect(
        service.addDatasetField('ds-1', { name: 'score' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('updateDatasetField', () => {
    it('updates alias/type and renames the key across features', async () => {
      const { service, datasetField, dataset } = createService();
      datasetField.findFirst.mockResolvedValue({
        id: 'fld-1',
        name: 'old',
        alias: '旧',
        type: 'string',
        nullable: true,
      });
      dataset.findUnique.mockResolvedValue({ currentVersionId: 'ver-1' });

      const res = await service.updateDatasetField('ds-1', 'old', {
        name: 'new',
        alias: '新',
      });

      expect(datasetField.update).toHaveBeenCalledWith({
        where: { id: 'fld-1' },
        data: expect.objectContaining({ name: 'new', alias: '新' }),
      });
      expect(res).toEqual({ datasetId: 'ds-1', name: 'new' });
    });

    it('throws 404 when the field does not exist', async () => {
      const { service, datasetField } = createService();
      datasetField.findFirst.mockResolvedValue(null);

      await expect(
        service.updateDatasetField('ds-1', 'nope', { alias: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('removeDatasetField', () => {
    it('deletes the field and strips the key from features', async () => {
      const { service, datasetField, dataset } = createService();
      datasetField.findFirst.mockResolvedValue({ id: 'fld-1', name: 'score' });
      dataset.findUnique.mockResolvedValue({ currentVersionId: 'ver-1' });

      const res = await service.removeDatasetField('ds-1', 'score');

      expect(datasetField.delete).toHaveBeenCalledWith({ where: { id: 'fld-1' } });
      expect(res).toEqual({ datasetId: 'ds-1', name: 'score' });
    });

    it('throws 404 when the field does not exist', async () => {
      const { service, datasetField } = createService();
      datasetField.findFirst.mockResolvedValue(null);

      await expect(
        service.removeDatasetField('ds-1', 'nope'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('createFeature', () => {
    it('inserts a feature with the provided id and returns it', async () => {
      const { service, dataset, execRaw } = createService();
      dataset.findUnique.mockResolvedValue({ currentVersionId: 'ver-1' });

      const res = await service.createFeature('ds-1', {
        id: 'f-1',
        geometry: { type: 'Point', coordinates: [0, 0] },
      });

      expect(execRaw).toHaveBeenCalledTimes(1);
      expect(res).toEqual({ featureId: 'f-1' });
    });

    it('generates an id when none is provided', async () => {
      const { service, dataset } = createService();
      dataset.findUnique.mockResolvedValue({ currentVersionId: 'ver-1' });

      const res = await service.createFeature('ds-1', {
        geometry: { type: 'Point', coordinates: [1, 2] },
      });

      expect(res.featureId).toBeTruthy();
      expect(typeof res.featureId).toBe('string');
    });

    it('throws 404 when the dataset has no current version', async () => {
      const { service, dataset } = createService();
      dataset.findUnique.mockResolvedValue({ currentVersionId: null });

      await expect(
        service.createFeature('ds-1', {
          geometry: { type: 'Point', coordinates: [0, 0] },
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
