// Offline demo: the reference lesson from the system prompt (column addition 245 + 874),
// expressed in the exact tool-call format the model streams. When OPENAI_API_KEY is not set,
// /api/draw replays this sequence so the executor, pacing and canvas can be seen without a key.
// It is a scripted sample, not a recorded model run.

export type DemoCall = { name: string; input: Record<string, unknown> }

const HL = '#fff59d'

export const demoLesson: DemoCall[] = [
  { name: 'say', input: { text: 'Складываем 245 и 874 в столбик.' } },
  { name: 'draw_text', input: { x: 180, y: 60, text: 'Сложение в столбик: 245 + 874', fontSize: 28 } },
  { name: 'wait', input: { ms: 1500 } },
  { name: 'say', input: { text: 'Записываем числа друг под другом, выравнивая по разрядам.' } },
  { name: 'draw_text', input: { x: 350, y: 180, text: '2 4 5', fontSize: 36 } },
  { name: 'wait', input: { ms: 1500 } },
  { name: 'draw_text', input: { x: 350, y: 240, text: '8 7 4', fontSize: 36 } },
  { name: 'draw_text', input: { x: 300, y: 240, text: '+', fontSize: 36, color: 'blue' } },
  { name: 'wait', input: { ms: 1500 } },
  { name: 'say', input: { text: 'Подводим черту.' } },
  { name: 'draw_line', input: { x1: 295, y1: 290, x2: 460, y2: 290, stroke: 'black', strokeWidth: 2 } },
  { name: 'wait', input: { ms: 1500 } },
  { name: 'say', input: { text: 'Складываем единицы: 5 плюс 4 равно 9.' } },
  { name: 'highlight_region', input: { x: 420, y: 170, w: 40, h: 120, color: HL, duration_ms: 3000 } },
  { name: 'draw_text', input: { x: 520, y: 180, text: '5 + 4 = 9', fontSize: 22, color: 'grey' } },
  { name: 'wait', input: { ms: 1500 } },
  { name: 'draw_text', input: { x: 425, y: 320, text: '9', fontSize: 36 } },
  { name: 'wait', input: { ms: 1500 } },
  { name: 'say', input: { text: 'Складываем десятки: 4 плюс 7 равно 11. Записываем 1, а 1 переносим в сотни.' } },
  { name: 'highlight_region', input: { x: 380, y: 170, w: 40, h: 120, color: HL, duration_ms: 3000 } },
  { name: 'draw_text', input: { x: 520, y: 240, text: '4 + 7 = 11', fontSize: 22, color: 'grey' } },
  { name: 'draw_text', input: { x: 352, y: 130, text: '1', fontSize: 22, color: 'red' } },
  { name: 'wait', input: { ms: 1500 } },
  { name: 'draw_text', input: { x: 385, y: 320, text: '1', fontSize: 36 } },
  { name: 'wait', input: { ms: 1500 } },
  { name: 'say', input: { text: 'Складываем сотни: 2 плюс 8 плюс перенесённая 1 равно 11.' } },
  { name: 'highlight_region', input: { x: 340, y: 170, w: 40, h: 120, color: HL, duration_ms: 3000 } },
  { name: 'draw_text', input: { x: 520, y: 300, text: '2 + 8 + 1 = 11', fontSize: 22, color: 'grey' } },
  { name: 'draw_text', input: { x: 310, y: 130, text: '1', fontSize: 22, color: 'red' } },
  { name: 'wait', input: { ms: 1500 } },
  { name: 'draw_text', input: { x: 345, y: 320, text: '1', fontSize: 36 } },
  { name: 'wait', input: { ms: 1500 } },
  { name: 'say', input: { text: 'В разряде тысяч остаётся перенесённая единица, записываем её.' } },
  { name: 'draw_text', input: { x: 305, y: 320, text: '1', fontSize: 36 } },
  { name: 'wait', input: { ms: 1500 } },
  { name: 'say', input: { text: 'Получили 1119. Готово.' } },
  { name: 'highlight_region', input: { x: 295, y: 305, w: 180, h: 45, color: '#a5f3fc', duration_ms: 5000 } },
]
