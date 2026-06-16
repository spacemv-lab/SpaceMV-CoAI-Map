/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 品牌与展示配置
 * map-core 库的默认品牌信息
 */

/** 底图服务配置 */
export const BASEMAP_BRAND = {
  /** 天地图 */
  tianditu: {
    name: '天地图',
    logo: '天地图.png',
    license: 'GS（2024）0568 号',
  },
} as const;

/** 项目品牌配置（库默认值） */
export const PROJECT_BRAND = {
  /** 项目名称 */
  name: 'SpaceMV-CoAI-Map',
} as const;