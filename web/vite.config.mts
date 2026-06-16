/// <reference types='vitest' />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// import cesium from 'vite-plugin-cesium';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import fs from 'fs';
import path from 'path';

// Project root directory (absolute path)
const projectRoot = path.resolve(import.meta.dirname, '..');

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const env: Record<string, string> = {};

  for (const rawLine of fileContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function readProcessEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }
  return env;
}

function loadProjectEnv(mode: string, command: 'build' | 'serve'): Record<string, string> {
  const processEnv = readProcessEnv();
  const env = loadEnv(mode, projectRoot, '');
  const deployEnv =
    processEnv.DEPLOY_ENV?.trim() || (command === 'serve' ? 'dev' : '');
  const fileEnv = deployEnv
    ? parseEnvFile(path.resolve(projectRoot, `.envs/map-ai/${deployEnv}/web.env`))
    : {};

  return { ...env, ...fileEnv, ...processEnv };
}

function requireEnv(name: string, env: Record<string, string>): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function buildClientEnvDefine(env: Record<string, string>): Record<string, string> {
  const define: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith('VITE_')) {
      continue;
    }
    define[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return define;
}

export default defineConfig(({ command, mode }) => {
  const env = loadProjectEnv(mode, command);
  const apiProxyTarget =
    command === 'serve' ? requireEnv('API_PROXY_TARGET', env) : undefined;
  const iamProxyTarget =
    command === 'serve' ? requireEnv('IAM_PROXY_TARGET', env) : undefined;
  const clientEnvDefine = buildClientEnvDefine(env);

  return {
    root: import.meta.dirname,
    cacheDir: '../node_modules/.vite/web',
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
        '@txwx-monorepo/api-client': path.resolve(
          projectRoot,
          'packages/api-client/src/index.ts',
        ),
        '@txwx-monorepo/chat-contracts': path.resolve(
          projectRoot,
          'packages/chat-contracts/src/index.ts',
        ),
        '@txwx-monorepo/ui-kit': path.resolve(
          projectRoot,
          'packages/ui-kit/src/index.ts',
        ),
      },
    },
    server: {
      port: 4200,
      host: 'localhost',
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        // IAM 服务代理（单点登录）- 开发期必须显式配置目标地址
        '/auth': {
          target: iamProxyTarget,
          changeOrigin: true,
        },
        // IAM system 接口（用户信息等）
        '/system': {
          target: iamProxyTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4200,
      host: 'localhost',
    },
    define: {
      CESIUM_BASE_URL: JSON.stringify('/cesium'),
      ...clientEnvDefine,
    },
    plugins: [
      // cesium(),
      react(),
      viteStaticCopy({
        targets: [
          {
            src: '../node_modules/cesium/Build/Cesium/Workers',
            dest: 'cesium',
          },
          {
            src: '../node_modules/cesium/Build/Cesium/ThirdParty',
            dest: 'cesium',
          },
          {
            src: '../node_modules/cesium/Build/Cesium/Assets',
            dest: 'cesium',
          },
          {
            src: '../node_modules/cesium/Build/Cesium/Widgets',
            dest: 'cesium',
          },
        ],
      }),
    ],
    // Uncomment this if you are using workers.
    // worker: {
    //   plugins: () => [ nxViteTsPaths() ],
    // },
    build: {
      outDir: '../dist/web',
      emptyOutDir: true,
      reportCompressedSize: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
    test: {
      name: 'map-ai',
      watch: false,
      globals: true,
      environment: 'jsdom',
      include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      reporters: ['default'],
      coverage: {
        reportsDirectory: '../coverage/web',
        provider: 'v8' as const,
      },
    },
  };
});
