/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { RightPanel } from '../right-panel';

/**
 * StylePanel 和 EditPanel 已整合到右侧 Tab 面板
 * 保留此组件作为向后兼容入口
 */
export function StylePanelWrapper() {
  return <RightPanel />;
}
