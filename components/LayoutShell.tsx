'use client'
// components/LayoutShell.tsx
// Wraps all page content. When the assistant sidebar opens, adds a right
// margin equal to the sidebar width so nothing gets obscured.

import { ReactNode } from 'react'
import { useAssistant } from '@/lib/AssistantContext'

const SIDEBAR_W = 400 // px — keep in sync with ClinicalAssistant panel width

export default function LayoutShell({ children }: { children: ReactNode }) {
  const { isOpen } = useAssistant()

  return (
    <div
      style={{
        marginRight:  isOpen ? SIDEBAR_W : 0,
        transition:   'margin-right 0.25s ease',
        minHeight:    '100vh',
      }}
    >
      {children}
    </div>
  )
}