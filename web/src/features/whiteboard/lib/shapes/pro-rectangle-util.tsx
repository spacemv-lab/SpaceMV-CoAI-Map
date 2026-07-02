/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * pro-rectangle 自定义形状：可调圆角 + 纯色/线性/径向渐变填充 + 描边。
 *
 * tldraw 内置 rectangle 既无 radius 也无 gradient（已核实），故用 tldraw 公开扩展点
 * ShapeUtil 自定义一个形状，不动 tldraw 源码。
 * 圆角与渐变在 component 里用 SVG 渲染；命中盒用 Rectangle2d（按 w/h）。
 *
 * 注：tldraw 4.5 的 ShapeUtil/TLShape 泛型约束为内置形状联合，不接受自定义类型参数；
 * 故此处 ShapeUtil 不传泛型，方法内把 shape 断言为 ProRectangleShape。
 */
import {
  ShapeUtil,
  Rectangle2d,
  HTMLContainer,
  T,
  type TLBaseShape,
  type TLShape,
  type TLResizeInfo,
} from '@tldraw/tldraw';

export type ProRectangleFillType = 'solid' | 'linear' | 'radial';

export interface ProRectangleProps {
  w: number;
  h: number;
  radius: number;
  fillType: ProRectangleFillType;
  fillColor: string;
  gradientFrom: string;
  gradientTo: string;
  gradientAngle: number;
  strokeColor: string;
  strokeWidth: number;
}

export type ProRectangleShape = TLBaseShape<'pro-rectangle', ProRectangleProps>;

/** 默认尺寸/样式，供 getDefaultProps 与工具栏「插入矩形」复用 */
export const PRO_RECT_DEFAULTS: ProRectangleProps = {
  w: 240,
  h: 160,
  radius: 12,
  fillType: 'solid',
  fillColor: '#3b82f6',
  gradientFrom: '#3b82f6',
  gradientTo: '#93c5fd',
  gradientAngle: 90,
  strokeColor: '#1e3a8a',
  strokeWidth: 2,
};

export class ProRectangleUtil extends ShapeUtil {
  static override type = 'pro-rectangle' as const;

  static override props = {
    w: T.number,
    h: T.number,
    radius: T.number,
    fillType: T.string,
    fillColor: T.string,
    gradientFrom: T.string,
    gradientTo: T.string,
    gradientAngle: T.number,
    strokeColor: T.string,
    strokeWidth: T.number,
  };

  override getDefaultProps() {
    return { ...PRO_RECT_DEFAULTS } as unknown as ProRectangleProps;
  }

  override getGeometry(shape: TLShape) {
    const { w, h } = (shape as unknown as ProRectangleShape).props;
    return new Rectangle2d({ width: w, height: h, isFilled: true });
  }

  // 启用缩放控制点：按拖拽比例缩放 w/h（圆角在 component 里自动 clamp 到 min(w,h)/2）
  override onResize(shape: TLShape, info: TLResizeInfo<TLShape>) {
    const s = shape as unknown as ProRectangleShape;
    return {
      ...s,
      props: {
        ...s.props,
        w: Math.max(1, info.initialBounds.width * info.scaleX),
        h: Math.max(1, info.initialBounds.height * info.scaleY),
      },
    };
  }

  override component(shape: TLShape) {
    const {
      w,
      h,
      radius,
      fillType,
      fillColor,
      gradientFrom,
      gradientTo,
      gradientAngle,
      strokeColor,
      strokeWidth,
    } = (shape as unknown as ProRectangleShape).props;

    // 唯一且合法的渐变 id（shape.id 含 ':'，清理掉）
    const gid = 'prorect-' + String(shape.id).replace(/[^a-zA-Z0-9_-]/g, '');
    const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
    const fill = fillType === 'solid' ? fillColor : `url(#${gid})`;

    return (
      <HTMLContainer style={{ width: w, height: h }}>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg">
          <defs>
            {fillType === 'linear' && (
              <linearGradient id={gid} gradientTransform={`rotate(${gradientAngle} 0.5 0.5)`}>
                <stop offset="0%" stopColor={gradientFrom} />
                <stop offset="100%" stopColor={gradientTo} />
              </linearGradient>
            )}
            {fillType === 'radial' && (
              <radialGradient id={gid}>
                <stop offset="0%" stopColor={gradientFrom} />
                <stop offset="100%" stopColor={gradientTo} />
              </radialGradient>
            )}
          </defs>
          <rect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={Math.max(0, w - strokeWidth)}
            height={Math.max(0, h - strokeWidth)}
            rx={r}
            ry={r}
            fill={fill}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        </svg>
      </HTMLContainer>
    );
  }

  override indicator(shape: TLShape) {
    const { w, h, radius } = (shape as unknown as ProRectangleShape).props;
    const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
    return <rect width={w} height={h} rx={r} ry={r} fill="none" />;
  }
}
