/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

// 天地图 Token - 通过环境变量配置
// 开发 fallback 用于本地调试（天地图公共服务，前端暴露是安全的）
export const TIANDITU_TOKEN = import.meta.env.VITE_TIANDITU_TOKEN || 'fbf8050680870ca47986efcfedb246e5';

// Cesium Ion Token - 通过环境变量配置
// 生产环境需要申请: https://cesium.com/ion/
export const CESIUM_ION = import.meta.env.VITE_CESIUM_ION || '';
