/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import {
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProjectShareService } from './project-share.service';

/**
 * ProjectShareService 单元测试
 * 完全 mock DatasetService（含 project / projectShare Prisma 委托与 getProjectState），
 * 无需真实数据库。覆盖：所有权校验、创建/列举/撤销、公开 token 解析
 * （有效/已撤销/已过期/未知/项目已删除 → 404）、viewCount 自增。
 */
function createService() {
  const projectShare = {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  };
  const project = { findUnique: jest.fn() };
  const datasetService: any = {
    projectShare,
    project,
    getProjectState: jest.fn(),
  };
  const config = {
    get: jest.fn(
      (key: string) =>
        key === 'PUBLIC_WEB_BASE_URL' ? 'https://map.test' : undefined,
    ),
  } as unknown as ConfigService;
  const service = new ProjectShareService(datasetService, config);
  return { service, projectShare, project, datasetService };
}

const baseShare = {
  id: 'share-1',
  token: 'tok-abc',
  projectId: 'proj-1',
  label: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  revokedAt: null,
  expiresAt: null,
  viewCount: 0,
};

describe('ProjectShareService', () => {
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

  describe('createShare', () => {
    it('generates a token and returns an absolute share URL', async () => {
      const { service, projectShare } = createService();
      projectShare.create.mockResolvedValue(baseShare);

      const dto = await service.createShare('proj-1', { label: 'wendao 文章 X' });

      expect(projectShare.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-1',
          label: 'wendao 文章 X',
          expiresAt: null,
        }),
      });
      expect(dto.token).toBe('tok-abc');
      expect(dto.url).toBe('https://map.test/share/tok-abc');
      // token is url-safe and non-empty
      expect(projectShare.create.mock.calls[0][0].data.token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('converts an ISO expiresAt to a Date', async () => {
      const { service, projectShare } = createService();
      projectShare.create.mockResolvedValue(baseShare);
      await service.createShare('proj-1', { expiresAt: '2027-01-01T00:00:00.000Z' });
      const passed = projectShare.create.mock.calls[0][0].data.expiresAt;
      expect(passed).toBeInstanceOf(Date);
    });
  });

  describe('listShares', () => {
    it('lists and maps shares for the project', async () => {
      const { service, projectShare } = createService();
      projectShare.findMany.mockResolvedValue([baseShare]);
      const list = await service.listShares('proj-1');
      expect(projectShare.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(list).toHaveLength(1);
      expect(list[0].url).toBe('https://map.test/share/tok-abc');
    });
  });

  describe('revokeShare', () => {
    it('sets revokedAt when the owner revokes', async () => {
      const { service, projectShare } = createService();
      projectShare.findUnique.mockResolvedValue({
        ...baseShare,
        project: { ownerId: 'user-1' },
      });
      projectShare.update.mockResolvedValue({ ...baseShare, revokedAt: new Date() });

      const revoked = await service.revokeShare('share-1', 'user-1');
      expect(projectShare.update).toHaveBeenCalledWith({
        where: { id: 'share-1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(revoked.revokedAt).toBeInstanceOf(Date);
    });

    it('throws 404 when the share does not exist', async () => {
      const { service, projectShare } = createService();
      projectShare.findUnique.mockResolvedValue(null);
      await expect(service.revokeShare('share-1', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws 403 when a non-owner revokes', async () => {
      const { service, projectShare } = createService();
      projectShare.findUnique.mockResolvedValue({
        ...baseShare,
        project: { ownerId: 'user-1' },
      });
      await expect(service.revokeShare('share-1', 'user-2')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(projectShare.update).not.toHaveBeenCalled();
    });
  });

  describe('resolvePublicShare', () => {
    const statePayload = {
      viewport: { center: [104.06, 30.67], zoom: 10 },
      basemap: 'tianditu-vec',
      layers: [{ id: 'l1' }],
      updatedAt: new Date('2026-06-01T00:00:00Z'),
    };

    it('returns the live view and atomically increments viewCount for a valid token', async () => {
      const { service, projectShare, datasetService } = createService();
      projectShare.findUnique.mockResolvedValue({
        ...baseShare,
        project: { id: 'proj-1', name: 'My Project' },
      });
      datasetService.getProjectState.mockResolvedValue(statePayload);

      const view = await service.resolvePublicShare('tok-abc');

      expect(datasetService.getProjectState).toHaveBeenCalledWith('proj-1');
      expect(projectShare.update).toHaveBeenCalledWith({
        where: { id: 'share-1' },
        data: { viewCount: { increment: 1 } },
      });
      expect(view).toEqual({
        project: { id: 'proj-1', name: 'My Project' },
        state: statePayload,
      });
    });

    it('throws 404 and does not leak state for an unknown token', async () => {
      const { service, projectShare, datasetService } = createService();
      projectShare.findUnique.mockResolvedValue(null);
      await expect(service.resolvePublicShare('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(datasetService.getProjectState).not.toHaveBeenCalled();
      expect(projectShare.update).not.toHaveBeenCalled();
    });

    it('throws 404 for a revoked token', async () => {
      const { service, projectShare, datasetService } = createService();
      projectShare.findUnique.mockResolvedValue({
        ...baseShare,
        revokedAt: new Date('2026-05-01T00:00:00Z'),
        project: { id: 'proj-1', name: 'My Project' },
      });
      await expect(service.resolvePublicShare('tok-abc')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(datasetService.getProjectState).not.toHaveBeenCalled();
      expect(projectShare.update).not.toHaveBeenCalled();
    });

    it('throws 404 for an expired token', async () => {
      const { service, projectShare, datasetService } = createService();
      projectShare.findUnique.mockResolvedValue({
        ...baseShare,
        expiresAt: new Date('2020-01-01T00:00:00Z'), // 过去
        project: { id: 'proj-1', name: 'My Project' },
      });
      await expect(service.resolvePublicShare('tok-abc')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(datasetService.getProjectState).not.toHaveBeenCalled();
    });

    it('throws 404 when the project has been deleted (cascade edge)', async () => {
      const { service, projectShare, datasetService } = createService();
      projectShare.findUnique.mockResolvedValue({
        ...baseShare,
        project: null,
      });
      await expect(service.resolvePublicShare('tok-abc')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(datasetService.getProjectState).not.toHaveBeenCalled();
    });
  });
});
