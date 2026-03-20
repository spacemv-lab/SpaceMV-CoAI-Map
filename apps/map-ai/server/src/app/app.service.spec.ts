/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { Test } from '@nestjs/testing';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeAll(async () => {
    const app = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    service = app.get<AppService>(AppService);
  });

  describe('getData', () => {
    it('should return "Hello API"', () => {
      expect(service.getData()).toEqual({ message: 'Hello API' });
    });
  });
});
