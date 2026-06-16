/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { describe, expect, it } from 'vitest';
import { createSingleFlightController } from './single-flight';

describe('createSingleFlightController', () => {
  it('reuses the same in-flight task for the same key', async () => {
    const controller = createSingleFlightController();
    let callCount = 0;

    const task = async () => {
      callCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return callCount;
    };

    const [firstResult, secondResult] = await Promise.all([
      controller.run('layer-1', task),
      controller.run('layer-1', task),
    ]);

    expect(callCount).toBe(1);
    expect(firstResult).toBe(1);
    expect(secondResult).toBe(1);
  });

  it('allows a new task after the previous one settles', async () => {
    const controller = createSingleFlightController();
    let callCount = 0;

    const task = async () => {
      callCount += 1;
      return callCount;
    };

    await controller.run('layer-1', task);
    const result = await controller.run('layer-1', task);

    expect(callCount).toBe(2);
    expect(result).toBe(2);
  });
});
