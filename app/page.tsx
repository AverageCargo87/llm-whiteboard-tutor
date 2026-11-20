'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import 'tldraw/tldraw.css'
import type { Editor } from 'tldraw'
import { executeToolCall } from '@/lib/executor'

// Tldraw трогает window/document при импорте — выключаем SSR.
const Tldraw = dynamic(() => import('tldraw').then((m) => m.Tldraw), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
      Загружаю канвас…
    </div>
  ),
})

interface ToolCall {
  name: string
  input: Record<string, unknown>
  status: 'ok' | 'error' | 'pending'
  note?: string
}

interface Narration {
  text: string
  spokenAt: number // ts (ms) для подсветки «текущей» реплики
}

export default function Page() {
  const editorRef = useRef<Editor | null>(null)
  const narrationEndRef = useRef<HTMLDivElement | null>(null)
  const [prompt, setPrompt] = useState('')
  const [running, setRunning] = useState(false)
  const [calls, setCalls] = useState<ToolCall[]>([])
  const [narrations, setNarrations] = useState<Narration[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showDebug, setShowDebug] = useState(false)

  const onMount = useCallback((editor: Editor) => {
    editorRef.current = editor
    editor.setCamera({ x: 0, y: 0, z: 1 })
    editor.updateInstanceState({ isGridMode: false })
  }, [])

  const handleClear = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const ids = Array.from(editor.getCurrentPageShapeIds())
    if (ids.length > 0) editor.deleteShapes(ids)
    setCalls([])
    setNarrations([])
    setError(null)
  }, [])

  // автоскролл нарративов вниз при появлении новой реплики
  useEffect(() => {
    narrationEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [narrations.length])

  const handleDraw = useCallback(async () => {
    const editor = editorRef.current
    if (!editor || running) return
    const userPrompt = prompt.trim()
    if (!userPrompt) return

    setRunning(true)
    setError(null)
    setCalls([])
    setNarrations([])

    try {
      const res = await fetch('/api/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userPrompt }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `HTTP ${res.status}`)
      }
      if (!res.body) throw new Error('пустой ответ')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        let sep
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const chunk = buffer.slice(0, sep)
          buffer = buffer.slice(sep + 2)
          const dataLine = chunk
            .split('\n')
            .find((l) => l.startsWith('data: '))
          if (!dataLine) continue
          let evt: { type: string; [k: string]: unknown }
          try {
            evt = JSON.parse(dataLine.slice(6))
          } catch {
            continue
          }
          if (evt.type === 'tool_use') {
            const name = String(evt.name)
            const input = (evt.input ?? {}) as Record<string, unknown>

            // say попадает и в нарратив, и в технический лог.
            if (name === 'say') {
              const text = typeof input.text === 'string' ? input.text : ''
              if (text) {
                setNarrations((prev) => [
                  ...prev,
                  { text, spokenAt: Date.now() },
                ])
              }
            }

            setCalls((prev) => [...prev, { name, input, status: 'pending' }])
            const result = await executeToolCall(editor, name, input)
            setCalls((prev) => {
              const next = prev.slice()
              for (let i = next.length - 1; i >= 0; i--) {
                if (next[i].status === 'pending') {
                  next[i] = {
                    ...next[i],
                    status: result.ok ? 'ok' : 'error',
                    note: result.note,
                  }
                  break
                }
              }
              return next
            })
          } else if (evt.type === 'text') {
            // Финальный текст модели — тоже как реплика учителя.
            const text = String(evt.text ?? '')
            if (text) {
              setNarrations((prev) => [...prev, { text, spokenAt: Date.now() }])
            }
          } else if (evt.type === 'error') {
            setError(String(evt.error ?? 'unknown error'))
          } else if (evt.type === 'done') {
            // ничего, цикл завершится сам
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }, [prompt, running])

  return (
    <div className="flex h-screen flex-col bg-white">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-2">
        <h1 className="text-sm font-semibold text-zinc-900">
          AI-учитель: песочница
        </h1>
        <span className="text-xs text-zinc-400">
          gpt-4o-mini · tldraw v3
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Канвас 70% */}
        <div className="relative w-[70%] border-r border-zinc-200">
          <Tldraw onMount={onMount} />
        </div>

        {/* Панель управления 30% */}
        <aside className="flex w-[30%] flex-col gap-2 bg-zinc-50 p-3">
          <label className="text-xs font-medium text-zinc-600">Промпт</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Например: объясни сложение 358 + 467 в столбик"
            className="h-24 resize-none rounded border border-zinc-300 bg-white p-2 text-sm focus:border-blue-500 focus:outline-none"
            disabled={running}
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDraw}
              disabled={running || !prompt.trim()}
              className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {running ? 'Рисую…' : 'Нарисовать'}
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={running}
              className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Очистить
            </button>
          </div>

          {error && (
            <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
              <div className="font-semibold">Ошибка</div>
              <div className="break-words">{error}</div>
            </div>
          )}

          {/* Нарратив учителя — основной блок */}
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-600">
              Объяснение учителя
            </span>
            <span className="text-xs text-zinc-400">
              {narrations.length} реплик
            </span>
          </div>
          <div className="flex-1 overflow-auto rounded border border-zinc-200 bg-white p-3 text-sm leading-relaxed">
            {narrations.length === 0 && !running && (
              <div className="text-zinc-400">
                Здесь будут появляться объяснения шагов синхронно с рисованием.
              </div>
            )}
            {running && narrations.length === 0 && (
              <div className="text-zinc-400 italic">Думаю…</div>
            )}
            {narrations.map((n, i) => {
              const isLast = i === narrations.length - 1
              return (
                <p
                  key={i}
                  className={
                    isLast && running
                      ? 'mb-2 rounded bg-blue-50 px-2 py-1 text-zinc-900 ring-1 ring-blue-200'
                      : 'mb-2 text-zinc-700'
                  }
                >
                  {n.text}
                </p>
              )
            })}
            <div ref={narrationEndRef} />
          </div>

          {/* Технический debug-лог — свернут по умолчанию */}
          <details
            className="rounded border border-zinc-200 bg-white"
            open={showDebug}
            onToggle={(e) => setShowDebug((e.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer px-2 py-1 text-xs font-medium text-zinc-600 select-none">
              Debug: tool calls ({calls.length})
            </summary>
            <div className="max-h-48 overflow-auto px-2 pb-2 font-mono text-[10px] leading-snug">
              {calls.length === 0 && (
                <div className="text-zinc-400">пока пусто</div>
              )}
              {calls.map((c, i) => (
                <div
                  key={i}
                  className="mb-1 border-b border-zinc-100 pb-1 last:border-b-0"
                >
                  <div className="flex items-center gap-1">
                    <span
                      className={
                        c.status === 'ok'
                          ? 'text-green-700'
                          : c.status === 'error'
                            ? 'text-red-700'
                            : 'text-amber-600'
                      }
                    >
                      {c.status === 'ok'
                        ? '✓'
                        : c.status === 'error'
                          ? '✗'
                          : '…'}
                    </span>
                    <span className="font-semibold text-blue-700">
                      {c.name}
                    </span>
                  </div>
                  <div className="break-all text-zinc-600">
                    {JSON.stringify(c.input)}
                  </div>
                  {c.note && <div className="text-zinc-400">{c.note}</div>}
                </div>
              ))}
            </div>
          </details>
        </aside>
      </div>
    </div>
  )
}
