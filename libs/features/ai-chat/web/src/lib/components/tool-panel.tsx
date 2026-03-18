/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import React from "react"
import type { ToolEvent } from "../../../../shared"

export type ToolPanelProps = {
  events: ToolEvent[]
  onToggleLayer?: (layerId: string, visible: boolean) => void
  className?: string
}

export function ToolPanel(props: ToolPanelProps) {
  const { events, onToggleLayer, className } = props
  return (
    <div className={["border-t", className].filter(Boolean).join(" ")} style={{ borderColor: "var(--ai-border)" }}>
      <div className="px-4 py-2 text-xs opacity-70">工具结果</div>
      <div className="max-h-48 overflow-auto px-4 pb-4 space-y-2">
        {events.map((evt) => (
          <div key={evt.id} className="rounded border p-2" style={{ borderColor: "var(--ai-border)" }}>
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium">{evt.type} · {evt.id.slice(0, 8)}</div>
              <div className="flex items-center gap-2">
                <button
                  className="text-xs px-2 py-1 rounded border"
                  style={{ borderColor: "var(--ai-border)" }}
                  onClick={() => onToggleLayer && onToggleLayer(evt.id, true)}
                >
                  显示
                </button>
                <button
                  className="text-xs px-2 py-1 rounded border"
                  style={{ borderColor: "var(--ai-border)" }}
                  onClick={() => onToggleLayer && onToggleLayer(evt.id, false)}
                >
                  隐藏
                </button>
              </div>
            </div>
            <pre className="mt-2 text-xs overflow-auto">
              {JSON.stringify({ data: evt.data, schema: evt.schema, plan: evt.plan }, null, 2)}
            </pre>
          </div>
        ))}
        {!events.length && (
          <div className="text-xs opacity-60">暂无工具结果</div>
        )}
      </div>
    </div>
  )
}

