/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * MapAI 应用品牌配置
 */

export const APP_BRAND = {
  /** 网站标题（浏览器标签页） */
  title: 'SpaceMV-CoAI-Map',

  /** Logo 文字 */
  logoText: 'SpaceMV-CoAI-Map',

  /** 项目全称 */
  projectName: 'SpaceMV-CoAI-Map',

  /** 公司信息 */
  company: {
    name: '天信卫星',
    year: '2024',
  },

  /** 技术支持 */
  support: {
    text: '技术支持',
    link: 'https://spacemv.com',
    name: 'SpaceMV',
  },
} as const;

/**
 * 设置页面标题
 */
export function setPageTitle(title?: string): void {
  document.title = title ?? APP_BRAND.title;
}