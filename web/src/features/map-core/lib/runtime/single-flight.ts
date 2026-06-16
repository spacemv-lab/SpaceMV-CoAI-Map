/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

export interface SingleFlightController {
  run<T>(key: string, task: () => Promise<T>): Promise<T>;
  isRunning(key: string): boolean;
}

export function createSingleFlightController(): SingleFlightController {
  const tasks = new Map<string, Promise<unknown>>();

  return {
    run<T>(key: string, task: () => Promise<T>): Promise<T> {
      const existingTask = tasks.get(key);
      if (existingTask) {
        return existingTask as Promise<T>;
      }

      const nextTask = (async () => task())();
      tasks.set(key, nextTask);

      void nextTask.finally(() => {
        if (tasks.get(key) === nextTask) {
          tasks.delete(key);
        }
      });

      return nextTask;
    },

    isRunning(key: string): boolean {
      return tasks.has(key);
    },
  };
}
