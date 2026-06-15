import type { Metadata } from 'next'
import './globals.css'
import { PageContextProvider }    from '@/components/PageContext'
import { AssistantProvider }      from '@/lib/AssistantContext'
import { PdfPanelProvider }       from '@/lib/PdfPanelContext'
import ClinicalAssistant          from '@/components/ClinicalAssistant'
import PdfViewerPanelWrapper      from '@/components/PdfViewerPanelWrapper'
import LayoutShell                from '@/components/LayoutShell'

export const metadata: Metadata = {
  title: 'MicrobiomeRx',
  description: 'Clinical gut microbiome analysis platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <PageContextProvider>
          <AssistantProvider>
            <PdfPanelProvider>
              <LayoutShell>
                {children}
              </LayoutShell>
              <PdfViewerPanelWrapper />
              <ClinicalAssistant />
            </PdfPanelProvider>
          </AssistantProvider>
        </PageContextProvider>
      </body>
    </html>
  )
}
