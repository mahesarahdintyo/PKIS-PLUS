'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Clock, FileText, Monitor } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

const DISPLAY_DOCUMENT_STORAGE_KEY = 'futaba.display.document'

function getDisplayDocumentStorageKey(lineId?: string | null) {
  return lineId ? `${DISPLAY_DOCUMENT_STORAGE_KEY}.${lineId}` : DISPLAY_DOCUMENT_STORAGE_KEY
}

interface DisplayDocument {
  id: string
  lineId?: string
  title: string
  description?: string
  category?: string
  type: string
  file: {
    name: string
    path: string
    size?: number
  }
  targetTime?: string | null
  updatedAt?: number
}

function readDisplayDocument(lineId?: string | null): DisplayDocument | null {
  try {
    const rawDocument = window.localStorage.getItem(getDisplayDocumentStorageKey(lineId))
    if (!rawDocument) return null

    const document = JSON.parse(rawDocument) as Partial<DisplayDocument>
    if (
      typeof document.id !== 'string' ||
      typeof document.title !== 'string' ||
      typeof document.type !== 'string' ||
      typeof document.file?.name !== 'string' ||
      typeof document.file?.path !== 'string'
    ) {
      return null
    }

    return {
      id: document.id,
      lineId: document.lineId,
      title: document.title,
      description: document.description,
      category: document.category,
      type: document.type,
      file: {
        name: document.file.name,
        path: document.file.path,
        size: document.file.size,
      },
      targetTime: document.targetTime,
      updatedAt: document.updatedAt,
    }
  } catch {
    return null
  }
}

function formatTargetTime(targetTime?: string | null) {
  if (!targetTime) return '-'

  const targetDate = new Date(targetTime)
  if (Number.isNaN(targetDate.getTime())) return '-'

  const day = String(targetDate.getDate()).padStart(2, '0')
  const month = String(targetDate.getMonth() + 1).padStart(2, '0')
  const year = targetDate.getFullYear()
  const hours = String(targetDate.getHours()).padStart(2, '0')
  const minutes = String(targetDate.getMinutes()).padStart(2, '0')

  return `${day}/${month}/${year} ${hours}:${minutes}`
}

function getCountdownState(targetTime?: string | null, currentTime: number = Date.now()) {
  if (!targetTime) {
    return {
      countdownLabel: '-',
      isExpired: false,
      progress: 0,
      badgeClassName: 'border-slate-800 bg-slate-900/60 text-slate-400',
    }
  }

  const targetTimestamp = new Date(targetTime).getTime()
  if (Number.isNaN(targetTimestamp)) {
    return {
      countdownLabel: '-',
      isExpired: false,
      progress: 0,
      badgeClassName: 'border-slate-800 bg-slate-900/60 text-slate-400',
    }
  }

  const diffMs = targetTimestamp - currentTime
  const isExpired = diffMs <= 0
  const absDiffSeconds = Math.floor(Math.abs(diffMs) / 1000)

  const days = Math.floor(absDiffSeconds / 86400)
  const hours = Math.floor((absDiffSeconds % 86400) / 3600)
  const minutes = Math.floor((absDiffSeconds % 3600) / 60)
  const seconds = absDiffSeconds % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days}h`)
  if (hours > 0 || days > 0) parts.push(`${hours}j`)
  parts.push(`${minutes}m`)
  parts.push(`${seconds}d`)

  const countdownLabel = `${isExpired ? 'Lewat ' : ''}${parts.join(' ')}`

  if (isExpired) {
    return {
      countdownLabel,
      isExpired: true,
      progress: 100,
      badgeClassName: 'border-red-500/40 bg-red-950/40 text-red-300',
    }
  }

  if (diffMs <= 3600 * 1000) {
    return {
      countdownLabel,
      isExpired: false,
      progress: 85,
      badgeClassName: 'border-amber-500/40 bg-amber-950/40 text-amber-300',
    }
  }

  return {
    countdownLabel,
    isExpired: false,
    progress: 40,
    badgeClassName: 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300',
  }
}

interface DisplayPageClientProps {
  lineId?: string
}

export default function DisplayPageClient({ lineId: routeLineId }: DisplayPageClientProps = {}) {
  const searchParams = useSearchParams()
  const lineId = routeLineId ?? searchParams.get('lineId') ?? searchParams.get('landId')

  const [document, setDocument] = useState<DisplayDocument | null>(() => readDisplayDocument(lineId))
  const [currentTime, setCurrentTime] = useState(() => Date.now())
  const [isClient, setIsClient] = useState(false)
  const isMountedRef = useRef(true)

  const isPDF = useMemo(() => {
    if (!document) return false
    return (
      document.type.toLowerCase() === 'pdf' ||
      document.file.name.toLowerCase().endsWith('.pdf') ||
      document.file.path.toLowerCase().endsWith('.pdf')
    )
  }, [document])

  const isImage = useMemo(() => {
    if (!document) return false
    const type = document.type.toLowerCase()
    const fileName = document.file.name.toLowerCase()
    const filePath = document.file.path.toLowerCase()

    return (
      type === 'jpg' ||
      type === 'jpeg' ||
      type === 'png' ||
      fileName.endsWith('.jpg') ||
      fileName.endsWith('.jpeg') ||
      fileName.endsWith('.png') ||
      filePath.endsWith('.jpg') ||
      filePath.endsWith('.jpeg') ||
      filePath.endsWith('.png')
    )
  }, [document])

  useEffect(() => {
    setIsClient(true)
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!lineId) return

    const sendHeartbeat = async () => {
      try {
        await fetch('/api/system/display-heartbeat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ lineId }),
        })
      } catch (error) {
        console.error('Display heartbeat send error:', error)
      }
    }

    const clearHeartbeat = () => {
      const params = new URLSearchParams({ lineId })
      navigator.sendBeacon?.('/api/system/display-heartbeat?' + params.toString())
      window.localStorage.removeItem(getDisplayDocumentStorageKey(lineId))
    }

    void sendHeartbeat()
    const heartbeatTimer = window.setInterval(() => {
      void sendHeartbeat()
    }, 10000)

    const handleBeforeUnload = () => {
      clearHeartbeat()
    }

    const handlePageHide = () => {
      clearHeartbeat()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      window.clearInterval(heartbeatTimer)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handlePageHide)
      clearHeartbeat()
    }
  }, [lineId])

  useEffect(() => {
    const syncDisplayDocument = async () => {
      try {
        const params = new URLSearchParams()
        if (lineId) {
          params.set('lineId', lineId)
        }

        const query = params.toString()
        const response = await fetch(`/api/display-document${query ? `?${query}` : ''}`, {
          cache: 'no-store',
        })

        if (!response.ok) return

        const data = (await response.json()) as { document?: DisplayDocument | null }
        if (!isMountedRef.current) return

        if (!data.document) {
          setDocument(null)
          if (lineId) {
            window.localStorage.removeItem(getDisplayDocumentStorageKey(lineId))
          }
          return
        }

        setDocument(data.document)
        if (lineId) {
          window.localStorage.setItem(
            getDisplayDocumentStorageKey(lineId),
            JSON.stringify(data.document)
          )
        }
      } catch (error) {
        console.error('Display document sync error:', error)
      }
    }

    void syncDisplayDocument()
    const syncTimer = window.setInterval(() => {
      void syncDisplayDocument()
    }, 2000)

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === getDisplayDocumentStorageKey(lineId)) {
        setDocument(readDisplayDocument(lineId))
      }
    }

    const handleFocus = () => {
      setDocument(readDisplayDocument(lineId))
      void syncDisplayDocument()
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      window.clearInterval(syncTimer)
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [lineId])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  const countdown = useMemo(() => {
    return getCountdownState(document?.targetTime, currentTime)
  }, [document?.targetTime, currentTime])

  const formattedTargetTime = useMemo(() => {
    return formatTargetTime(document?.targetTime)
  }, [document?.targetTime])

  const clockString = useMemo(() => {
    if (!isClient) return '--:--:--'
    return new Date(currentTime).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }, [currentTime, isClient])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-slate-100 select-none">
      <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-800/80 bg-slate-950/90 px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Monitor className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white">
              FUTABA PKIS
            </h1>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Live TV Display
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-1.5 font-mono text-sm font-semibold tracking-wider text-slate-200">
            <Clock className="h-4 w-4 text-slate-400" />
            <span>{clockString}</span>
          </div>
        </div>
      </header>

      {document && (
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-800/60 bg-slate-900/40 px-6 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white truncate max-w-[500px]">
                {document.title}
              </h2>
              {document.description && (
                <p className="text-xs text-slate-400 truncate max-w-[500px]">
                  {document.description}
                </p>
              )}
            </div>
          </div>

          {document.targetTime && (
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-right">
                <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  Target Waktu
                </span>
                <span className="text-xs font-semibold text-slate-300">
                  {formattedTargetTime}
                </span>
              </div>
              <div className={`rounded-xl border px-3 py-1 text-xs font-bold ${countdown.badgeClassName}`}>
                {countdown.countdownLabel}
              </div>
            </div>
          )}
        </div>
      )}

      <main className="flex-1 relative overflow-hidden bg-slate-950">
        {!document ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center p-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-900 border border-slate-800 text-slate-600">
              <Monitor className="h-10 w-10" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-lg font-bold text-slate-300">
                Belum Ada Dokumen Ditampilkan
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Pilih dokumen pada aplikasi operator untuk menampilkannya secara langsung di layar TV ini.
              </p>
            </div>
          </div>
        ) : isPDF ? (
          <iframe
            src={`/api/documents/${document.id}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
            className="h-full w-full border-0"
            title={document.title}
          />
        ) : isImage ? (
          <div className="flex h-full w-full items-center justify-center p-4">
            <img
              src={`/api/documents/${document.id}`}
              alt={document.title}
              className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
            />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center p-8">
            <FileText className="h-12 w-12 text-slate-500" />
            <h3 className="text-base font-bold text-slate-300">{document.title}</h3>
            <p className="text-xs text-slate-500">
              Format dokumen ini ({document.type}) tidak dapat dipratinjau langsung.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
