'use client'

import { useRef, useState, useEffect } from 'react'
import PdfToggleButton from '@/components/PdfToggleButton'
import { uploadReportPdf, reportPdfViewUrl } from '@/lib/reportPdf'
import { usePdfPanel } from '@/lib/PdfPanelContext'

type Props = {
  reportId: string
  initialPdfStored?: boolean   // pass !!report.pdf_filename from parent — skips the loading flicker
}

export default function ReportPdfActions({ reportId, initialPdfStored }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  // Initialise from prop so the button renders immediately on first paint
  const [pdfStored, setPdfStored] = useState<boolean | null>(initialPdfStored ?? null)
  const [error, setError]         = useState<string | null>(null)
  const { openPdf, closePdf, isPdfOpen } = usePdfPanel()

  const pdfUrl = reportPdfViewUrl(reportId)

  // HEAD check still runs to confirm storage truth, but result only overrides
  // when it contradicts the initial prop (e.g. file was deleted externally).
  useEffect(() => {
    let cancelled = false

    fetch(pdfUrl, { method: 'HEAD', credentials: 'include' })
      .then(res => { if (!cancelled) setPdfStored(res.ok) })
      .catch(() => { if (!cancelled) setPdfStored(false) })

    return () => { cancelled = true }
  }, [pdfUrl])

  const handleFile = async (f: File) => {
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      await uploadReportPdf(reportId, f)
      setPdfStored(true)
      if (isPdfOpen) closePdf()
      openPdf(`${pdfUrl}?t=${Date.now()}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'PDF upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {pdfStored === true ? (
          <PdfToggleButton pdfUrl={pdfUrl} variant="header" />
        ) : pdfStored === false ? (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
              style={{ background: '#FFFFFF', border: '1px solid #E2F3D0', color: '#538A22' }}
            >
              {uploading ? 'Saving PDF…' : 'Add PDF'}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
                e.target.value = ''
              }}
            />
          </>
        ) : null}
      </div>
      {error && (
        <p className="text-[10px] text-red-600 font-mono max-w-xs text-right">{error}</p>
      )}
    </div>
  )
}