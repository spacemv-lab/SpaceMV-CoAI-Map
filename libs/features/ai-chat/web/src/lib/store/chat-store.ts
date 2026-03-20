/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { useSyncExternalStore } from "react"

export type ChatRole = "user" | "assistant" | "system"

export type ChatSession = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  pinned?: boolean
}

export type Attachment = {
  id: string
  type: "text" | "image" | "audio" | "video" | "geojson" | "file"
  name?: string
  url?: string
  meta?: Record<string, unknown>
}

export type ChatMessageStatus = "pending" | "streaming" | "final" | "error"

export type ChatMessage = {
  id: string
  sessionId: string
  role: ChatRole
  content: string
  parts?: Array<{ kind: "text" | "code" | "link" | "image"; value: string }>
  attachments?: Attachment[]
  status?: ChatMessageStatus
  usage?: { promptTokens?: number; completionTokens?: number; durationMs?: number }
  feedback?: "up" | "down"
  createdAt: number
  updatedAt: number
}

type StoreState = {
  sessions: ChatSession[]
  messages: Record<string, ChatMessage[]>
  activeSessionId: string | null
}

const LS_KEY = "aichat_store_v1"

function now() {
  return Date.now()
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

let state: StoreState = load() || {
  sessions: [],
  messages: {},
  activeSessionId: null,
}

const stoppedIds = new Set<string>()

const subscribers = new Set<() => void>()

function notify() {
  for (const fn of subscribers) fn()
  save()
}

function load(): StoreState | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state))
  } catch {}
}

export function useChatStore<T>(selector: (s: StoreState) => T) {
  return useSyncExternalStore(
    (cb) => {
      subscribers.add(cb)
      return () => subscribers.delete(cb)
    },
    () => selector(state),
    () => selector(state)
  )
}

export function getActiveSessionId() {
  return state.activeSessionId
}

export function setActiveSessionId(id: string | null) {
  state.activeSessionId = id
  notify()
}

export function listSessions() {
  return state.sessions
}

export function createSession(title?: string) {
  const id = uid()
  const ses: ChatSession = {
    id,
    title: title || "新对话",
    createdAt: now(),
    updatedAt: now(),
  }
  state.sessions.unshift(ses)
  state.messages[id] = []
  state.activeSessionId = id
  notify()
  return ses
}

export function renameSession(id: string, title: string) {
  const s = state.sessions.find((x) => x.id === id)
  if (!s) return
  s.title = title
  s.updatedAt = now()
  notify()
}

export function deleteSession(id: string) {
  state.sessions = state.sessions.filter((x) => x.id !== id)
  delete state.messages[id]
  if (state.activeSessionId === id) {
    state.activeSessionId = state.sessions[0]?.id || null
  }
  notify()
}

export function pinSession(id: string, pinned: boolean) {
  const s = state.sessions.find((x) => x.id === id)
  if (!s) return
  s.pinned = pinned
  s.updatedAt = now()
  notify()
}

export function listMessages(sessionId: string) {
  return state.messages[sessionId] || []
}

export function addMessage(msg: Omit<ChatMessage, "createdAt" | "updatedAt">) {
  const next: ChatMessage = { ...msg, createdAt: now(), updatedAt: now() }
  if (!state.messages[next.sessionId]) state.messages[next.sessionId] = []
  state.messages[next.sessionId].push(next)
  const s = state.sessions.find((x) => x.id === next.sessionId)
  if (s) s.updatedAt = now()
  notify()
  return next
}

export function updateMessage(id: string, sessionId: string, patch: Partial<ChatMessage>) {
  if (stoppedIds.has(id)) return
  const arr = state.messages[sessionId]
  if (!arr) return
  const idx = arr.findIndex((x) => x.id === id)
  if (idx < 0) return
  arr[idx] = { ...arr[idx], ...patch, updatedAt: now() }
  notify()
}

export function removeMessage(id: string, sessionId: string) {
  const arr = state.messages[sessionId]
  if (!arr) return
  state.messages[sessionId] = arr.filter((x) => x.id !== id)
  notify()
}

export function clearSessionMessages(sessionId: string) {
  state.messages[sessionId] = []
  notify()
}

export function ensureDefaultSession() {
  if (!state.sessions.length) {
    createSession("新对话")
  }
}

export function stopMessageUpdates(id: string) {
  stoppedIds.add(id)
}
