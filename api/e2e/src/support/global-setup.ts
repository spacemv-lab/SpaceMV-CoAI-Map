/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

var __TEARDOWN_MESSAGE__: string;

module.exports = async function () {
  const host = process.env.HOST ?? 'localhost';
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  const start = Date.now();
  const timeoutMs = 30000;

  while (Date.now() - start < timeoutMs) {
    try {
      const socket = await tryConnect(host, port);
      socket.destroy();
      globalThis.__TEARDOWN_MESSAGE__ = '\nTearing down...\n';
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error(`Timed out waiting for ${host}:${port} to become available`);
};

function tryConnect(host: string, port: number) {
  return new Promise<any>((resolve, reject) => {
    const net = require('node:net');
    const socket = net.createConnection({ host, port });
    socket.once('connect', () => resolve(socket));
    socket.once('error', (error: unknown) => reject(error));
  });
}
