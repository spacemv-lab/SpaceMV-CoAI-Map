/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import {
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { WhiteboardService } from './whiteboard.service';

/**
 * WhiteboardService 单元测试
 * 完全 mock DatasetService（含 whiteboardDoc / project Prisma 委托），无需真实数据库。
 * 覆盖：所有权校验（404/403）、getDoc（存在/空板）、upsertDoc（404/upsert 入参）。
 */
function createService() {
  const whiteboardDoc = {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  };
  const project = { findUnique: jest.fn() };
  const datasetService: any = { whiteboardDoc, project };
  const service = new WhiteboardService(datasetService);
  return { service, whiteboardDoc, project, datasetService };
}

const baseDoc = {
  id: 'doc-1',
  projectId: 'proj-1',
  document: { schema: {}, store: {} },
  createdAt: new Date('2026-06-01T00:00:00Z'),
  updatedAt: new Date('2026-06-02T00:00:00Z'),
};

describe('WhiteboardService', () => {
  describe('assertOwnership', () => {
    it('passes for the owner', async () => {
      const { service, project } = createService();
      project.findUnique.mockResolvedValue({ ownerId: 'user-1' });
      await expect(service.assertOwnership('proj-1', 'user-1')).resolves.toBeUndefined();
    });

    it('throws 404 when the project does not exist', async () => {
      const { service, project } = createService();
      project.findUnique.mockResolvedValue(null);
      await expect(service.assertOwnership('proj-1', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws 403 for a non-owner', async () => {
      const { service, project } = createService();
      project.findUnique.mockResolvedValue({ ownerId: 'user-1' });
      await expect(service.assertOwnership('proj-1', 'user-2')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('getDoc', () => {
    it('returns the stored document when it exists', async () => {
      const { service, whiteboardDoc } = createService();
      whiteboardDoc.findUnique.mockResolvedValue(baseDoc);
      const dto = await service.getDoc('proj-1');
      expect(whiteboardDoc.findUnique).toHaveBeenCalledWith({ where: { projectId: 'proj-1' } });
      expect(dto).toEqual({
        projectId: 'proj-1',
        document: baseDoc.document,
        updatedAt: baseDoc.updatedAt,
      });
    });

    it('returns an empty board (document null) when no record exists', async () => {
      const { service, whiteboardDoc } = createService();
      whiteboardDoc.findUnique.mockResolvedValue(null);
      const dto = await service.getDoc('proj-1');
      expect(dto).toEqual({ projectId: 'proj-1', document: null, updatedAt: null });
    });
  });

  describe('upsertDoc', () => {
    it('upserts the document keyed on projectId', async () => {
      const { service, whiteboardDoc, project } = createService();
      project.findUnique.mockResolvedValue({ id: 'proj-1', ownerId: 'user-1' });
      whiteboardDoc.upsert.mockResolvedValue(baseDoc);

      const doc = { schema: { a: 1 }, store: { b: 2 } };
      const dto = await service.upsertDoc('proj-1', doc);

      expect(whiteboardDoc.upsert).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        create: { projectId: 'proj-1', document: doc },
        update: { document: doc },
      });
      expect(dto.document).toBe(baseDoc.document);
    });

    it('throws 404 when the project does not exist', async () => {
      const { service, whiteboardDoc, project } = createService();
      project.findUnique.mockResolvedValue(null);
      await expect(service.upsertDoc('proj-1', { x: 1 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(whiteboardDoc.upsert).not.toHaveBeenCalled();
    });
  });

  describe('publishPreview', () => {
    it('stores the preview dataUrl on an existing board', async () => {
      const { service, whiteboardDoc } = createService();
      whiteboardDoc.findUnique.mockResolvedValue(baseDoc);
      whiteboardDoc.update.mockResolvedValue({ ...baseDoc, previewDataUrl: 'data:image/png;base64,xxx' });

      const res = await service.publishPreview('proj-1', 'data:image/png;base64,xxx');

      expect(whiteboardDoc.update).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        data: { previewDataUrl: 'data:image/png;base64,xxx' },
      });
      expect(res.updatedAt).toBeInstanceOf(Date);
    });

    it('throws 404 when no board exists yet', async () => {
      const { service, whiteboardDoc } = createService();
      whiteboardDoc.findUnique.mockResolvedValue(null);
      await expect(service.publishPreview('proj-1', 'data:...')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(whiteboardDoc.update).not.toHaveBeenCalled();
    });
  });

  describe('getPreview', () => {
    it('returns the stored dataUrl', async () => {
      const { service, whiteboardDoc } = createService();
      whiteboardDoc.findUnique.mockResolvedValue({ previewDataUrl: 'data:image/png;base64,abc' });
      expect(await service.getPreview('proj-1')).toBe('data:image/png;base64,abc');
    });

    it('returns null when no preview / no doc', async () => {
      const { service, whiteboardDoc } = createService();
      whiteboardDoc.findUnique.mockResolvedValue(null);
      expect(await service.getPreview('proj-1')).toBeNull();
    });
  });

  describe('getPreviewStatus', () => {
    it('returns hasPreview true when a preview exists', async () => {
      const { service, whiteboardDoc } = createService();
      whiteboardDoc.findUnique.mockResolvedValue({ previewDataUrl: 'data:image/jpeg;base64,xxx' });
      expect(await service.getPreviewStatus('proj-1')).toEqual({ hasPreview: true });
    });

    it('returns hasPreview false when no preview or no doc', async () => {
      const { service, whiteboardDoc } = createService();
      whiteboardDoc.findUnique.mockResolvedValue(null);
      expect(await service.getPreviewStatus('proj-1')).toEqual({ hasPreview: false });
    });
  });
});
