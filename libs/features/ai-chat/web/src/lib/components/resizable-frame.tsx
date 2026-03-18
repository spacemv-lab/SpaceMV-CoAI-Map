/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import React, { useRef, useState } from 'react';

export type ResizableFrameProps = {
  initialWidth?: number;
  initialHeight?: number;
  initialLeft?: number;
  initialTop?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  className?: string;
  children?: React.ReactNode;
};

export function ResizableFrame(props: ResizableFrameProps) {
  const {
    initialWidth = 800,
    initialHeight = 600,
    initialLeft = 0,
    initialTop = 0,
    minWidth = 320,
    minHeight = 300,
    maxWidth = 1600,
    maxHeight = 1200,
    className,
    children,
  } = props;
  const [size, setSize] = useState<{ w: number; h: number }>({
    w: initialWidth,
    h: initialHeight,
  });
  const [pos, setPos] = useState<{ x: number; y: number }>({
    x: initialLeft,
    y: initialTop,
  });
  const frameRef = useRef<HTMLDivElement | null>(null);

  const onResizeStart = (
    e: React.PointerEvent,
    dir: 'right' | 'bottom' | 'corner',
  ) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = size.w;
    const startH = size.h;
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const nextW = Math.max(
        Math.min(
          startW + (dir === 'right' || dir === 'corner' ? dx : 0),
          maxWidth,
        ),
        minWidth,
      );
      const nextH = Math.max(
        Math.min(
          startH + (dir === 'bottom' || dir === 'corner' ? dy : 0),
          maxHeight,
        ),
        minHeight,
      );
      setSize({ w: nextW, h: nextH });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const findDragHandle = (el: EventTarget | null): HTMLElement | null => {
    let node = el as HTMLElement | null;
    while (node) {
      if (
        node.getAttribute &&
        node.getAttribute('data-rf-drag-handle') !== null
      )
        return node;
      node = node.parentElement;
    }
    return null;
  };

  const onDragStart = (e: React.PointerEvent) => {
    const handle = findDragHandle(e.target);
    if (!handle) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...pos };
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      setPos({ x: startPos.x + dx, y: startPos.y + dy });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      ref={frameRef}
      onPointerDown={onDragStart}
      className={['absolute shadow-2xl backdrop-blur-sm', className]
        .filter(Boolean)
        .join(' ')}
      style={{
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        backgroundColor: 'transparent',
        border: '1px solid var(--ai-border)',
        borderRadius: 8,
      }}
    >
      <div className="absolute inset-0 overflow-hidden">{children}</div>
      <div
        onPointerDown={(e) => onResizeStart(e, 'right')}
        className="absolute top-0 right-0 h-full w-1 cursor-col-resize"
        style={{ backgroundColor: 'transparent' }}
      />
      <div
        onPointerDown={(e) => onResizeStart(e, 'bottom')}
        className="absolute bottom-0 left-0 w-full h-1 cursor-row-resize"
        style={{ backgroundColor: 'transparent' }}
      />
      <div
        onPointerDown={(e) => onResizeStart(e, 'corner')}
        className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize"
        style={{ backgroundColor: 'var(--ai-border)' }}
      />
    </div>
  );
}
