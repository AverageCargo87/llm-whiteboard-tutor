import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import type {
  ChatCompletionTool,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions'
import { drawTools } from '@/lib/tools'
import { demoLesson } from '@/lib/demo-lesson'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `Ты — AI-учитель математики для 5 класса. Объясняешь темы РИСУЯ на доске через tools СИНХРОННО с озвучкой через tool say.

═══ ТЕМП ═══
Объяснение должно ЧИТАТЬСЯ медленно и спокойно — это для 5-классника, не для пресс-релиза. Шейпы у нас плавно проявляются через fade-in ~900мс, поэтому минимальная пауза после draw — 1500мс, иначе следующий шейп начнёт появляться раньше чем предыдущий «устоится».
- ОБЯЗАТЕЛЬНО вызывай tool wait(2200-3500ms) ПОСЛЕ каждого draw_* и highlight_region.
  Исключение: 2-3 действия неделимы по смыслу (например, серия цифр одной строки слагаемого) — их можно дать подряд без wait между ними, но wait после всей группы — обязателен и подлиннее (3000мс).
- ПЕРЕД каждым логическим шагом сначала вызывай say с короткой фразой что и зачем сейчас делаешь.
  say идёт параллельно с рисованием — это твой голос за кадром.
- Длительность highlight_region — 3500-5000мс (даём ребёнку рассмотреть подсветку с запасом).
- Типичный ритм: say → draw_text → wait 2500 → draw_text → wait 3000 → highlight_region → wait 3000 → say → ...
- Помни — после finish'а никаких больше колл; не вызывай finish пока не выписан ответ полностью.

═══ КАК ВЫЗЫВАТЬ TOOLS — ЧИТАЙ ВНИМАТЕЛЬНО ═══
КРИТИЧНО: за один свой ответ выдавай 8-15 tool calls подряд, охватывая целую логическую фазу объяснения. НЕ выдавай по одному-два тула и не останавливайся — это растягивает объяснение на десятки лишних API-раундов.

Конкретные ориентиры:
- Целое объяснение должно уложиться в 4-6 твоих ответов максимум.
- Один ответ = одна фаза: например, «вступление + запись слагаемых + черта» — это один ответ из ~10 tool calls (1 say, 4 draw_text, 1 draw_line, 4 wait).
- Следующий ответ = «складываем единицы»: 1 say, 1 highlight, 2 draw_text, 2 wait — ~6 tool calls.
- И так далее. Не дробь по одному вызову на ответ.

═══ КАК ЗАВЕРШАТЬ ═══
Ты НЕ имеешь права отвечать обычным текстом — каждый твой ответ ОБЯЗАН быть набором tool calls. Это enforce'ится на уровне API (tool_choice: required).

Чтобы сообщить «всё, объяснение готово» — вызови tool finish (один раз, в самом конце последнего ответа, после всех say/draw/wait). НЕ вызывай finish раньше времени — пока есть что объяснять, не вызывай его.

Бюджет: 30 ответов max. После принудительный обрыв. Не доводи.

═══ КАНВАС И КООРДИНАТЫ ═══
- Видимая область канваса 800x600. (0,0) — левый верх. Центр ~ (400, 300).
- fontSize: 28-36 для основных цифр, 18-22 для подписей, 32-40 для заголовка.
- Один символ при fontSize 32 занимает ~18px по горизонтали и ~32px по вертикали.
- Между строками цифр — минимум 60px по y. Между разрядами — минимум 30px по x.
- НЕ нагромождай шейпы. Если новая запись попадает в зону уже нарисованного — сдвигай её или используй другую часть канваса.

═══ ШАБЛОН СТОЛБИКОВОГО СЛОЖЕНИЯ (опорный, под трёхзначные) ═══
say "Складываем 245 и 874 в столбик."
draw_text заголовок: x=180, y=60, "Сложение в столбик: 245 + 874", fontSize 28
wait 2500
say "Записываем числа друг под другом, выравнивая по разрядам."
draw_text "2 4 5"  на x=350, y=180, fontSize 36 (один символ ~20px, пробелы держат столбцы)
wait 3000
draw_text "8 7 4"  на x=350, y=240, fontSize 36
draw_text "+"      на x=300, y=240, fontSize 36, color "blue"
wait 2500
say "Подводим черту."
draw_line  x1=295,y1=290 → x2=460,y2=290, stroke="black", strokeWidth=2
wait 2500
say "Складываем единицы: 5 плюс 4 равно 9."
highlight_region вокруг столбца единиц: x=420, y=170, w=40, h=120, color="#fff59d", duration_ms=4000
wait 3000
draw_text боковое: x=520, y=180, "5 + 4 = 9", fontSize 22, color "grey"
wait 2500
draw_text "9"  результат единиц: x=425, y=320, fontSize 36
wait 3000
say "Складываем десятки: 4 плюс 7 равно 11. Записываем 1, 1 переносим в сотни."
highlight_region на десятках: x=380, y=170, w=40, h=120, color="#fff59d", duration_ms=4000
draw_text боковое: x=520, y=240, "4 + 7 = 11", fontSize 22, color "grey"
draw_text перенос-1: x=352, y=130, "1", fontSize 22, color "red"   (carry над сотнями!)
wait 3000
draw_text "1"  на x=385, y=320, fontSize 36   (десятки результата)
wait 3000
say "Складываем сотни: 2 плюс 8 плюс перенесённая 1 равно 11. Записываем 1, 1 переносим."
highlight_region на сотнях: x=340, y=170, w=40, h=120, color="#fff59d", duration_ms=4000
draw_text боковое: x=520, y=300, "2 + 8 + 1 = 11", fontSize 22, color "grey"
draw_text перенос-1: x=310, y=130, "1", fontSize 22, color "red"   (carry над тысячами)
wait 3000
draw_text "1"  на x=345, y=320, fontSize 36   (сотни результата)
wait 3000
say "В разряде тысяч у нас перенесённая единица — записываем её."
draw_text "1"  на x=305, y=320, fontSize 36   (тысячи результата)
wait 2500
say "Получили 1119. Готово."
highlight_region на ответе: x=295, y=305, w=180, h=45, color="#a5f3fc", duration_ms=5000

═══ ОБЩИЕ ПРАВИЛА ═══
- carry-цифры (перенос) — fontSize 20-22, color "red", над тем разрядом куда переносим.
- highlight_region — короткие подсветки на 1.2-2 секунды, цвета мягкие пастельные через hex.
- Боковые пояснения арифметики (вроде "5+4=9") — fontSize 18-22, color "grey", справа от основной записи (x ≥ 520).
- Не используй emoji.
- Заверши без лишнего комментария когда объяснение готово.`

// gpt-4o-mini is ~17x cheaper than gpt-4o ($0.15/$0.60 vs $2.50/$10 per 1M tokens) and,
// for this task (coordinates + pacing), follows the template about as well.
// Switch to gpt-4o if harder topics start to drift.
const MODEL = 'gpt-4o-mini'

// Upper bound on "model -> tool_calls -> stub tool_result -> model" rounds.
const MAX_AGENT_TURNS = 30

// Adapt the provider-agnostic tool schemas to OpenAI function calling.
const openaiTools: ChatCompletionTool[] = drawTools.map((t) => ({
  type: 'function',
  function: {
    name: t.name,
    description: t.description,
    parameters: t.parameters as unknown as Record<string, unknown>,
  },
}))

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
}

// No API key: replay the reference lesson in the same event format the model produces.
// The client paces playback itself (it awaits every `wait` call), so events go out at once.
function demoResponse(): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      send({
        type: 'text',
        text: 'Demo mode: OPENAI_API_KEY is not set, replaying the built-in reference lesson.',
      })
      demoLesson.forEach((call, i) =>
        send({ type: 'tool_use', id: `demo_${i}`, name: call.name, input: call.input }),
      )
      send({ type: 'done', finish_reason: 'demo', usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } })
      controller.close()
    },
  })
  return new Response(stream, { headers: SSE_HEADERS })
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  // Note: shell environment variables override .env.local in Next.js, so an empty
  // OPENAI_API_KEY exported in the shell also lands here.
  if (!apiKey) return demoResponse()

  let prompt = ''
  try {
    const body = (await req.json()) as { prompt?: unknown }
    prompt = typeof body.prompt === 'string' ? body.prompt : ''
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!prompt.trim()) {
    return new Response(JSON.stringify({ error: 'prompt is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const client = new OpenAI({ apiKey })
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          /* the client already closed the stream */
        }
      }

      // Agent loop. After a batch of tool_calls the model stops and waits for tool results.
      // Drawing tools are fire-and-forget (the canvas runs in the browser), so each call gets
      // a stub "ok" result and the loop continues until the model calls `finish`.
      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ]

      let totalPromptTokens = 0
      let totalCompletionTokens = 0
      let lastFinishReason: string | null | undefined = undefined

      let finishedExplicitly = false

      try {
        for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
          const completion = client.chat.completions.stream({
            model: MODEL,
            messages,
            tools: openaiTools,
            // The model must answer with tool calls only; the one way to stop is `finish`.
            tool_choice: 'required',
            stream_options: { include_usage: true },
          })

          completion.on('tool_calls.function.arguments.done', (e) => {
            // `finish` is a control signal, not a visible step: do not forward it.
            if (e.name === 'finish') {
              finishedExplicitly = true
              return
            }
            let input: unknown = e.parsed_arguments
            if (input == null) {
              try {
                input = JSON.parse(e.arguments)
              } catch {
                input = {}
              }
            }
            send({
              type: 'tool_use',
              id: `t${turn}_${e.index}`,
              name: e.name,
              input,
            })
          })

          completion.on('content.done', (e) => {
            if (e.content) send({ type: 'text', text: e.content })
          })

          const final = await completion.finalChatCompletion()
          const choice = final.choices[0]
          const message = choice?.message
          lastFinishReason = choice?.finish_reason

          if (final.usage) {
            totalPromptTokens += final.usage.prompt_tokens ?? 0
            totalCompletionTokens += final.usage.completion_tokens ?? 0
          }

          // Clean exit once the model has called finish.
          if (finishedExplicitly) break

          // Safety net: no tool_calls (should not happen with tool_choice: 'required').
          if (!message?.tool_calls || message.tool_calls.length === 0) break

          // Append the assistant turn plus stub results and go to the next round.
          messages.push(message)
          for (const tc of message.tool_calls) {
            if (tc.type === 'function') {
              messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: 'ok',
              })
            }
          }
        }

        send({
          type: 'done',
          finish_reason: finishedExplicitly
            ? 'finished'
            : lastFinishReason === 'tool_calls'
              ? 'max_turns'
              : lastFinishReason,
          usage: {
            prompt_tokens: totalPromptTokens,
            completion_tokens: totalCompletionTokens,
            total_tokens: totalPromptTokens + totalCompletionTokens,
          },
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        send({ type: 'error', error: msg })
      } finally {
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }
    },
  })

  return new Response(stream, { headers: SSE_HEADERS })
}
