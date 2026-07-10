/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { Toaster } from 'sonner';
import { setPageTitle } from './constants/brand';
import { useAuthStore } from './store/useAuthStore';
import { useMapStore } from './features/map-core/lib/store/use-map-store';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './styles.css';
import AppRouter from './routes/index';

// 设置页面标题
setPageTitle();

// 开发模式加载基准测试模块（暴露 window.runBenchmarkTest）
if (import.meta.env.DEV) {
  import('@/features/map-core');
}

// 初始化认证状态检查
useAuthStore.getState().checkAuthStatus();

// 拉取天地图 token（平台兜底，公开接口；地图渲染器据此 gate 初始化）
useMapStore.getState().loadTiandituToken();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

root.render(
  <StrictMode>
    <AppRouter />
    <Toaster />
  </StrictMode>,
);
