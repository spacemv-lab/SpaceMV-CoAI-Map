/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { Injectable, Logger } from '@nestjs/common';

/**
 * Parsed feature result
 */
export interface ParsedFeature {
  properties: Record<string, any>;
  geometry: any; // GeoJSON geometry object
}

/**
 * Parsed dataset result
 */
export interface ParseResult {
  features: ParsedFeature[];
  geometryType: string;
  recordCount: number;
  sourceCRS?: string;
  bbox?: [number, number, number, number];
  fields?: { name: string; type: string }[];
}

/**
 * Base adapter interface for all file format adapters
 */
export abstract class BaseAdapter {
  protected readonly logger = new Logger(BaseAdapter.name);

  /**
   * Get supported file extensions
   */
  abstract getSupportedExtensions(): string[];

  /**
   * Check if this adapter can handle the given file
   */
  canHandle(filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase();
    return this.getSupportedExtensions().includes(ext || '');
  }

  /**
   * Parse the file and return structured data
   */
  abstract parse(filePathOrBuffer: string | Buffer): Promise<ParseResult>;

  /**
   * Validate the file structure before parsing
   */
  async validate(filePathOrBuffer: string | Buffer): Promise<{ valid: boolean; errors: string[] }> {
    try {
      await this.parse(filePathOrBuffer);
      return { valid: true, errors: [] };
    } catch (error) {
      return { valid: false, errors: [error.message] };
    }
  }

  /**
   * Get file metadata
   */
  abstract getMetadata(filePathOrBuffer: string | Buffer): Promise<Record<string, any>>;
}
