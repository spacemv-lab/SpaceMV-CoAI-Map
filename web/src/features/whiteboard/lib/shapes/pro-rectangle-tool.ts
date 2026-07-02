/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * pro-rectangle 绘图工具：选中后在画布上拖拽创建一个 pro-rectangle（按拖拽框尺寸）。
 *
 * 继承 tldraw 的 BaseBoxShapeTool（盒形拖拽创建的内置逻辑：idle→pointing→dragging），
 * shapeType 指向我们的自定义形状。工具经 editor.root.addChild 注册后，setCurrentTool 生效。
 */
import { BaseBoxShapeTool } from '@tldraw/tldraw';

export class ProRectangleTool extends BaseBoxShapeTool {
  static override id = 'pro-rectangle' as const;
  static override initial = 'idle';
  // tldraw 的 shapeType 类型是内置盒形联合，自定义形状需断言
  override shapeType = 'pro-rectangle' as any;
}
