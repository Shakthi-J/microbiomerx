'use client'
// components/LayoutShell.tsx
// Wraps all page content. When the assistant sidebar or PDF panel opens,
// adds a right margin equal to the panel width so nothing gets obscured.

import { ReactNode } from 'react'
import { useAssistant } from '@/lib/AssistantContext'
import { usePdfPanel }  from '@/lib/PdfPanelContext'

const SIDEBAR_W = 400  // px — keep in sync with ClinicalAssistant panel width
const PDF_W     = 440  // px — keep in sync with PdfViewerPanelWrapper width

export default function LayoutShell({ children }: { children: ReactNode }) {
  const { isOpen }    = useAssistant()
  const { isPdfOpen } = usePdfPanel()

  const marginRight = (isOpen ? SIDEBAR_W : 0) + (isPdfOpen ? PDF_W : 0)

  return (
    <div
      style={{
        marginRight: marginRight,
        transition:  'margin-right 0.25s ease',
        minHeight:   '100vh',
      }}
    >
      {children}
    </div>
  )
}