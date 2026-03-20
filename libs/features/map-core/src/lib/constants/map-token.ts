/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


// 天地图 Token - 通过环境变量配置，本地开发可使用默认值
export const TIANDITU_TOKEN = import.meta.env.VITE_TIANDITU_TOKEN || 'fbf8050680870ca47986efcfedb246e5';

// Cesium Ion Token - 通过环境变量配置，本地开发可使用默认值
export const CESIUM_ION =
  import.meta.env.VITE_CESIUM_ION || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5YmMwMWQzMS1iZjg4LTRlZDItYTNmZC01MWEyMzk4NmYwNzEiLCJpZCI6MjQwNjA4LCJpYXQiOjE3MjYwMjAyNzR9.oHC1L475KukrHI4ppPwqjJB0rQUbV4cr4le-6m6ceHQ';
