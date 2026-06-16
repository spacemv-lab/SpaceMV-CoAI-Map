/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatasetService } from './dataset.service';
import {
  CreateProjectDto,
  SaveProjectStateDto,
} from '../dto/project.dto';
import { success } from './api-response';

@Controller('projects')
export class ProjectController {
  private readonly logger = new Logger(ProjectController.name);

  constructor(private readonly datasetService: DatasetService) {}

  // ============================================
  // Project CRUD
  // ============================================

  @Get()
  async listProjects(
    @Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
    @Query('take', new ParseIntPipe({ optional: true })) take?: number,
    @Query('ownerId') ownerId?: string,
  ) {
    return success(await this.datasetService.listProjects({
      skip: skip || 0,
      take: take || 100,
      ownerId,
    }));
  }

  @Get(':id')
  async getProject(@Param('id') id: string) {
    const project = await this.datasetService.getProject(id);
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    // Get dataset count using aggregation
    const countResult = await this.datasetService.dataset.count({
      where: { projectId: id },
    });

    return success({
      id: project.id,
      name: project.name,
      description: project.description,
      ownerId: project.ownerId,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      datasetCount: countResult,
    });
  }

  @Post()
  async createProject(@Body() body: CreateProjectDto) {
    this.logger.log(`Creating project: ${body.name}`);
    return success(await this.datasetService.createProject({
      name: body.name,
      description: body.description,
      ownerId: body.ownerId || 'default-user',
    }));
  }

  @Delete(':id')
  async deleteProject(@Param('id') id: string) {
    try {
      // Schema cascade delete handles state deletion
      return success(await this.datasetService.deleteProject(id));
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Project ${id} not found`);
      }
      throw error;
    }
  }

  // ============================================
  // Project State
  // ============================================

  @Get(':id/state')
  async getProjectState(@Param('id') id: string) {
    // Ensure project exists
    const project = await this.datasetService.getProject(id);
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    return success(await this.datasetService.getProjectState(id));
  }

  @Put(':id/state')
  async saveProjectState(
    @Param('id') id: string,
    @Body() body: SaveProjectStateDto,
  ) {
    // Ensure project exists
    const project = await this.datasetService.getProject(id);
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    this.logger.log(`Saving state for project ${id}`);
    const state = await this.datasetService.saveProjectState(id, body);

    return success({
      success: true,
      updatedAt: state.updatedAt,
    });
  }
}
