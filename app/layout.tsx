import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI-учитель: песочница',
  description:
    'Прототип AI-учителя математики, который рисует объяснения на tldraw-канвасе.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="m-0 flex min-h-full flex-col">{children}</body>
    </html>
  )
}
