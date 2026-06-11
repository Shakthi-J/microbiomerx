'use client'
// components/shell.tsx
// Shifts page content left to make room for PDF panel and/or assistant sidebar.
// Handles all combinations: neither open, one open, or both open.

import { ReactNode } from 'react'
import { useAssistant } from '@/lib/AssistantContext'
import { usePdfPanel, PDF_PANEL_W, ASSISTANT_W } from '@/lib/PdfPanelContext'

export default function shell({ children }: { children: ReactNode }) {
  const { isOpen: isAssistantOpen } = useAssistant()
  const { isPdfOpen }               = usePdfPanel()

  const marginRight =
    (isPdfOpen     ? PDF_PANEL_W  : 0) +
    (isAssistantOpen ? ASSISTANT_W : 0)

  return (
    <div style={{ marginRight, transition: 'margin-right 0.25s ease', minHeight: '100vh' }}>
      {children}
    </div>
  )
}