'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowLeft, Clock, FileText, Loader2, Maximize, Minimize, Monitor, Tv } from 'lucide-react'
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

function getFileExtension(fileName: string) {
  const parts = fileName.toLowerCase().split('.')
  return parts.length > 1 ? parts[parts.length - 1] ?? '' : ''
}

function getDisplayMode(document: DisplayDocument) {
  const extension = getFileExtension(document.file.name)

  if (document.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) {
    return 'image'
  }

  if (document.type.startsWith('video/') || ['mp4', 'mov', 'webm'].includes(extension)) {
    return 'video'
  }

  return 'frame'
}

function getTypeLabel(document: DisplayDocument) {
  const extension = getFileExtension(document.file.name)
  if (extension) return extension.toUpperCase()

  const parts = document.type.split('/')
  const subtype = parts[parts.length - 1]
  return subtype ? subtype.toUpperCase() : 'FILE'
}

function formatDateTime(date: Date) {
  const pad = (value: number) => value < 10 ? '0' + value : value.toString()
  const formattedDate = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)

  return `${formattedDate}, ${pad(date.getHours())}.${pad(date.getMinutes())}`
}

function formatDisplayTime(updatedAt?: number) {
  if (!updatedAt) return '-'

  const date = new Date(updatedAt)
  if (Number.isNaN(date.getTime())) return '-'

  return formatDateTime(date)
}

function formatTargetTime(targetTime?: string | null) {
  if (!targetTime) return '-'

  const date = new Date(targetTime)
  if (Number.isNaN(date.getTime())) return '-'

  return formatDateTime(date)
}

function isSameDisplayDocument(
  currentDocument: DisplayDocument | null,
  nextDocument: DisplayDocument | null
) {
  if (!currentDocument || !nextDocument) return currentDocument === nextDocument

  return (
    currentDocument.id === nextDocument.id &&
    currentDocument.title === nextDocument.title &&
    currentDocument.description === nextDocument.description &&
    currentDocument.category === nextDocument.category &&
    currentDocument.type === nextDocument.type &&
    currentDocument.file.name === nextDocument.file.name &&
    currentDocument.file.path === nextDocument.file.path &&
    currentDocument.file.size === nextDocument.file.size &&
    currentDocument.targetTime === nextDocument.targetTime &&
    currentDocument.updatedAt === nextDocument.updatedAt
  )
}

function isSameFile(
  currentDocument: DisplayDocument | null,
  nextDocument: DisplayDocument | null
) {
  if (!currentDocument || !nextDocument) return currentDocument === nextDocument
  return (
    currentDocument.id === nextDocument.id &&
    currentDocument.file.path === nextDocument.file.path
  )
}

interface DisplayPageClientProps {
  lineId?: string
}

export default function DisplayPageClient({ lineId: routeLineId }: DisplayPageClientProps = {}) {
  const searchParams = useSearchParams()
  const lineId = routeLineId ?? searchParams.get('lineId') ?? searchParams.get('landId')
  const [document, setDocument] = useState<DisplayDocument | null>(null)
  const [fileUrl, setFileUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentTime, setCurrentTime] = useState(() => Date.now())
  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = () => {
    if (!window.document.fullscreenElement) {
      window.document.documentElement.requestFullscreen().catch(() => {})
    } else {
      if (window.document.exitFullscreen) {
        window.document.exitFullscreen().catch(() => {})
      }
    }
  }

  useEffect(() => {
    // Otomatis full screen saat masuk ke display
    const enterFullscreen = async () => {
      try {
        if (!window.document.fullscreenElement) {
          await window.document.documentElement.requestFullscreen()
        }
      } catch (err) {
        console.warn('Fullscreen auto-trigger ignored by browser policy:', err)
      }
    }
    enterFullscreen()

    const handleFullscreenChange = () => {
      setIsFullscreen(!!window.document.fullscreenElement)
    }
    window.document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      window.document.removeEventListener('fullscreenchange', handleFullscreenChange)
      if (window.document.fullscreenElement && window.document.exitFullscreen) {
        window.document.exitFullscreen().catch(() => {})
      }
    }
  }, [])

  const displayMode = useMemo(
    () => (document ? getDisplayMode(document) : 'frame'),
    [document]
  )
  const sideRailClassName = 'top-[72px] h-[calc(100%-72px)] py-6'
  const leftSideRailBackgroundClassName = displayMode === 'frame'
    ? 'bg-transparent'
    : 'bg-gradient-to-r from-black via-black/85 to-transparent'
  const rightSideRailBackgroundClassName = displayMode === 'frame'
    ? 'bg-transparent'
    : 'bg-gradient-to-l from-black via-black/85 to-transparent'

  useEffect(() => {
    const originalBodyOverflow = window.document.body.style.overflow
    const originalHtmlOverflow = window.document.documentElement.style.overflow

    window.document.body.style.overflow = 'hidden'
    window.document.documentElement.style.overflow = 'hidden'

    return () => {
      window.document.body.style.overflow = originalBodyOverflow
      window.document.documentElement.style.overflow = originalHtmlOverflow
    }
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (!lineId) return

    let heartbeatTimeoutId: number

    const sendHeartbeat = async () => {
      try {
        await fetch('/api/system/display-heartbeat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ lineId }),
          keepalive: true,
        })
      } catch (error) {
        console.error('Display heartbeat error:', error)
      } finally {
        heartbeatTimeoutId = window.setTimeout(sendHeartbeat, 5000)
      }
    }

    const clearDisplayDocument = () => {
      const params = new URLSearchParams({ lineId })

      window.localStorage.removeItem(getDisplayDocumentStorageKey(lineId))

      fetch(`/api/system/display-heartbeat?${params.toString()}`, {
        method: 'DELETE',
        keepalive: true,
      }).catch((error) => {
        console.error('Display heartbeat clear error:', error)
      })

      fetch(`/api/display-document?${params.toString()}`, {
        method: 'DELETE',
        keepalive: true,
      }).catch((error) => {
        console.error('Display clear error:', error)
      })
    }

    sendHeartbeat()

    window.addEventListener('pagehide', clearDisplayDocument)

    return () => {
      window.removeEventListener('pagehide', clearDisplayDocument)
      window.clearTimeout(heartbeatTimeoutId)
    }
  }, [lineId])

  useEffect(() => {
    let pollingTimeoutId: number

    async function loadServerDisplayDocument() {
      try {
        const params = new URLSearchParams()
        if (lineId) {
          params.set('lineId', lineId)
        }

        const response = await fetch(`/api/display-document${params.toString() ? `?${params.toString()}` : ''}`, {
          cache: 'no-store',
        })

        if (!response.ok) return

        const data = await response.json()
        const nextDocument = data.document as DisplayDocument | null

        setDocument((currentDocument) => {
          if (!nextDocument) {
            window.localStorage.removeItem(DISPLAY_DOCUMENT_STORAGE_KEY)
            window.localStorage.removeItem(getDisplayDocumentStorageKey(lineId))
            return null
          }

          if (isSameDisplayDocument(currentDocument, nextDocument)) {
            return currentDocument
          }

          window.localStorage.setItem(
            getDisplayDocumentStorageKey(lineId),
            JSON.stringify(nextDocument)
          )

          return nextDocument
        })
      } catch (error) {
        console.error('Display polling error:', error)
      } finally {
        pollingTimeoutId = window.setTimeout(loadServerDisplayDocument, 1000)
      }
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === getDisplayDocumentStorageKey(lineId)) {
        setDocument(readDisplayDocument(lineId))
      }
    }

    const handleLocalChange = () => {
      setDocument(readDisplayDocument(lineId))
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('futaba-display-document-change', handleLocalChange)

    loadServerDisplayDocument()

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('futaba-display-document-change', handleLocalChange)
      window.clearTimeout(pollingTimeoutId)
    }
  }, [lineId])

  const prevDocumentRef = useRef<DisplayDocument | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadFileUrl() {
      if (!document) {
        setFileUrl('')
        setError('')
        prevDocumentRef.current = null
        return
      }

      // Jika file yang di-display sama (id + path), skip reload URL
      if (isSameFile(prevDocumentRef.current, document)) {
        return
      }

      prevDocumentRef.current = document

      try {
        setIsLoading(true)
        setError('')
        setFileUrl('')

        const response = await fetch('/api/download', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filePath: document.file.path,
          }),
        })

        if (!response.ok) {
          const data = await response.json().catch(() => null)
          throw new Error(data?.error ?? `Gagal memuat file display (${response.status})`)
        }

        const data = await response.json()
        if (typeof data.url !== 'string') {
          throw new Error('URL file display tidak valid')
        }

        if (isMounted) {
          setFileUrl(data.url)
        }
      } catch (error) {
        console.error('Display file load error:', error)
        if (isMounted) {
          setFileUrl('')
          setError(error instanceof Error ? error.message : 'Gagal memuat file display')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadFileUrl()

    return () => {
      isMounted = false
    }
  }, [document])

  return (
    <main className="fixed inset-0 h-screen w-screen overflow-hidden bg-black text-white">
      {/* Floating Header Controls */}
      <div className="pointer-events-auto fixed top-4 right-4 z-50 flex items-center gap-2">
        <Link
          href="/display"
          className="flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-lg border border-slate-700/60 bg-slate-900/80 backdrop-blur-md text-slate-200 hover:bg-slate-800 hover:text-white transition shadow-lg cursor-pointer"
          title="Kembali ke Pemilihan Mesin / Line"
        >
          <ArrowLeft size={15} />
          <span>Pilih Mesin</span>
        </Link>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="flex items-center justify-center p-2 rounded-lg border border-slate-700/60 bg-slate-900/80 backdrop-blur-md text-slate-200 hover:bg-slate-800 hover:text-white transition shadow-lg cursor-pointer"
          title={isFullscreen ? "Exit Fullscreen (F11)" : "Fullscreen (F11)"}
        >
          {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </button>
      </div>

      <section className="h-full w-full overflow-hidden flex items-center justify-center">
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Loader2 className="h-10 w-10 text-emerald-400 animate-spin mb-4" />
            <p className="text-slate-300 font-medium text-sm">Memuat dokumen display...</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="max-w-md p-8 rounded-2xl bg-slate-900/80 border border-amber-500/30 text-center shadow-2xl backdrop-blur-md">
            <AlertCircle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">File Dokumen Belum Tersedia</h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              {error.includes('Object not found')
                ? 'File dokumen yang tersimpan sebelumnya tidak ditemukan di storage. Silakan pilih dan tampilkan dokumen kerja kembali melalui halaman Operator.'
                : error}
            </p>
            <p className="text-xs text-slate-500">
              Layar akan otomatis memperbarui tampilan saat operator menekan tombol &ldquo;Tampilkan&rdquo;.
            </p>
          </div>
        )}

        {!isLoading && !error && !document && (
          <div className="max-w-md p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center shadow-2xl">
            <Tv className="h-12 w-12 text-slate-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Menunggu Dokumen Kerja</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Silakan pilih line produksi dan tampilkan dokumen melalui halaman Operator untuk memunculkannya pada layar ini.
            </p>
          </div>
        )}

        {document && fileUrl && !isLoading && !error && displayMode === 'image' && (
          <img
            key={`${document.id}-${document.file.path}-${document.updatedAt}`}
            src={fileUrl}
            alt={document.title}
            className="h-screen w-screen object-contain"
          />
        )}

        {document && fileUrl && !isLoading && !error && displayMode === 'video' && (
          <video
            key={`${document.id}-${document.file.path}-${document.updatedAt}`}
            src={fileUrl}
            className="h-screen w-screen object-contain"
            controls
            autoPlay
          />
        )}

        {document && fileUrl && !isLoading && !error && displayMode === 'frame' && (
          <iframe
            key={`${document.id}-${document.file.path}-${document.updatedAt}`}
            src={fileUrl}
            title={document.title}
            className="block h-screen w-screen border-0 bg-white"
          />
        )}
      </section>

      <aside className={`pointer-events-none absolute left-0 z-10 flex w-[clamp(120px,24vw,210px)] flex-col justify-between px-4 lg:w-[clamp(120px,10vw,210px)] ${sideRailClassName} ${leftSideRailBackgroundClassName}`}>
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
              Dokumen
            </p>
            <h1 className="mt-2 line-clamp-4 text-sm font-semibold leading-snug text-white">
              {document?.title ?? 'Belum ada file'}
            </h1>
          </div>

          {document && (
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                <FileText className="h-3.5 w-3.5 text-[#67e8f9]" />
                {getTypeLabel(document)}
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
                  Target Waktu
                </p>
                <p className="mt-2 text-sm font-semibold capitalize leading-snug text-[#34d399]">
                  {formatTargetTime(document.targetTime)}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 text-[11px] text-white/55">
          <div className="h-px w-12 bg-white/25" />
          <p>Futaba Display</p>
          <p className="leading-relaxed">
            Konten akan mengikuti file terakhir yang dipilih dari operator.
          </p>
        </div>
      </aside>

      <aside className={`pointer-events-none absolute right-0 z-10 hidden w-[clamp(120px,10vw,210px)] flex-col items-end justify-between px-4 text-right lg:flex ${sideRailClassName} ${rightSideRailBackgroundClassName}`}>
        <div className="space-y-4">
          <div className="ml-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#059669]/40 bg-[#059669]/15">
            <Monitor className="h-5 w-5 text-[#34d399]" />
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
              Status
            </p>
            <p className="mt-2 text-sm font-semibold text-[#34d399]">
              Live Display
            </p>
          </div>
        </div>

        <div className="space-y-3 text-[11px] text-white/55">
          <div className="ml-auto h-px w-12 bg-white/25" />
          <div className="inline-flex max-w-full items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-white/75">
            <Clock className="h-3.5 w-3.5" />
            <span className="capitalize leading-snug">
              {formatDisplayTime(currentTime)}
            </span>
          </div>
          <p className="leading-relaxed">
            Tekan Tampilkan pada halaman operator untuk mengganti layar ini.
          </p>
        </div>
      </aside>
    </main>
  )
}
