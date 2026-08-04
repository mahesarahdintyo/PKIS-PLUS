import { useEffect, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import {
  Clock,
  Eye,
  EyeOff,
  FileArchive,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideoCamera,
  HardDrive,
  Loader2,
  MonitorUp,
  Pencil,
  RotateCcw,
  Presentation,
  Save,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog'
import { toast } from 'sonner'

const DISPLAY_DOCUMENT_STORAGE_KEY = 'futaba.display.document'

function getDisplayDocumentStorageKey(landId?: string) {
  return landId ? `${DISPLAY_DOCUMENT_STORAGE_KEY}.${landId}` : DISPLAY_DOCUMENT_STORAGE_KEY
}

interface DocumentCardProps {
  id: string
  landId?: string
  title: string
  description: string
  category: string
  type: string
  file: {
    name: string
    path: string
    size?: number
  }
  targetTime?: string | null
  hiddenFromOperator?: boolean
  onDelete?: (id: string) => void | Promise<void>
  onVisibilityChange?: (id: string, hiddenFromOperator: boolean) => void
  showOperatorActions?: boolean
}

interface FileIconMeta {
  Icon: LucideIcon
  containerClassName: string
  iconClassName: string
  labelClassName: string
  containerStyle: CSSProperties
  iconStyle: CSSProperties
  labelStyle: CSSProperties
}

const extensionGroups = {
  spreadsheet: ['xls', 'xlsx', 'csv', 'ods'],
  presentation: ['ppt', 'pptx', 'odp'],
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'],
  video: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz'],
  code: ['html', 'css', 'js', 'jsx', 'ts', 'tsx', 'json', 'xml', 'sql'],
}

function getFileExtension(fileName: string) {
  const parts = fileName.toLowerCase().split('.')
  return parts.length > 1 ? parts[parts.length - 1] ?? '' : ''
}

function getFileIconMeta(type: string, fileName: string): FileIconMeta {
  const normalizedType = type.toLowerCase()
  const extension = getFileExtension(fileName)

  if (normalizedType.includes('pdf') || extension === 'pdf') {
    return {
      Icon: FileText,
      containerClassName: 'bg-[#fef2f2] group-hover:bg-[#fee2e2]',
      iconClassName: 'text-[#dc2626]',
      labelClassName: 'bg-[#fef2f2] text-[#b91c1c]',
      containerStyle: { backgroundColor: '#fef2f2' },
      iconStyle: { color: '#dc2626' },
      labelStyle: { backgroundColor: '#fef2f2', color: '#b91c1c' },
    }
  }

  if (
    normalizedType.includes('spreadsheet') ||
    normalizedType.includes('excel') ||
    extensionGroups.spreadsheet.includes(extension)
  ) {
    return {
      Icon: FileSpreadsheet,
      containerClassName: 'bg-[#ecfdf5] group-hover:bg-[#d1fae5]',
      iconClassName: 'text-[#059669]',
      labelClassName: 'bg-[#ecfdf5] text-[#047857]',
      containerStyle: { backgroundColor: '#ecfdf5' },
      iconStyle: { color: '#059669' },
      labelStyle: { backgroundColor: '#ecfdf5', color: '#047857' },
    }
  }

  if (
    normalizedType.includes('presentation') ||
    normalizedType.includes('powerpoint') ||
    extensionGroups.presentation.includes(extension)
  ) {
    return {
      Icon: Presentation,
      containerClassName: 'bg-[#fff7ed] group-hover:bg-[#ffedd5]',
      iconClassName: 'text-[#ea580c]',
      labelClassName: 'bg-[#fff7ed] text-[#c2410c]',
      containerStyle: { backgroundColor: '#fff7ed' },
      iconStyle: { color: '#ea580c' },
      labelStyle: { backgroundColor: '#fff7ed', color: '#c2410c' },
    }
  }

  if (normalizedType.startsWith('image/') || extensionGroups.image.includes(extension)) {
    return {
      Icon: FileImage,
      containerClassName: 'bg-[#ecfeff] group-hover:bg-[#cffafe]',
      iconClassName: 'text-[#0891b2]',
      labelClassName: 'bg-[#ecfeff] text-[#0e7490]',
      containerStyle: { backgroundColor: '#ecfeff' },
      iconStyle: { color: '#0891b2' },
      labelStyle: { backgroundColor: '#ecfeff', color: '#0e7490' },
    }
  }

  if (normalizedType.startsWith('video/') || extensionGroups.video.includes(extension)) {
    return {
      Icon: FileVideoCamera,
      containerClassName: 'bg-[#f5f3ff] group-hover:bg-[#ede9fe]',
      iconClassName: 'text-[#7c3aed]',
      labelClassName: 'bg-[#f5f3ff] text-[#6d28d9]',
      containerStyle: { backgroundColor: '#f5f3ff' },
      iconStyle: { color: '#7c3aed' },
      labelStyle: { backgroundColor: '#f5f3ff', color: '#6d28d9' },
    }
  }

  if (
    normalizedType.includes('zip') ||
    normalizedType.includes('compressed') ||
    normalizedType.includes('archive') ||
    extensionGroups.archive.includes(extension)
  ) {
    return {
      Icon: FileArchive,
      containerClassName: 'bg-[#fffbeb] group-hover:bg-[#fef3c7]',
      iconClassName: 'text-[#d97706]',
      labelClassName: 'bg-[#fffbeb] text-[#b45309]',
      containerStyle: { backgroundColor: '#fffbeb' },
      iconStyle: { color: '#d97706' },
      labelStyle: { backgroundColor: '#fffbeb', color: '#b45309' },
    }
  }

  if (normalizedType.includes('json') || normalizedType.includes('xml') || extensionGroups.code.includes(extension)) {
    return {
      Icon: FileCode,
      containerClassName: 'bg-[#f1f5f9] group-hover:bg-[#e2e8f0]',
      iconClassName: 'text-[#334155]',
      labelClassName: 'bg-[#f1f5f9] text-[#334155]',
      containerStyle: { backgroundColor: '#f1f5f9' },
      iconStyle: { color: '#334155' },
      labelStyle: { backgroundColor: '#f1f5f9', color: '#334155' },
    }
  }

  return {
    Icon: FileText,
    containerClassName: 'bg-[#dbeafe] group-hover:bg-[#bfdbfe]',
    iconClassName: 'text-[#2563eb]',
    labelClassName: 'bg-[#eff6ff] text-[#1d4ed8]',
    containerStyle: { backgroundColor: '#dbeafe' },
    iconStyle: { color: '#2563eb' },
    labelStyle: { backgroundColor: '#eff6ff', color: '#1d4ed8' },
  }
}

function getTypeLabel(type: string, fileName: string) {
  const extension = getFileExtension(fileName)
  if (extension) return extension.toUpperCase()

  const parts = type.split('/')
  const subtype = parts[parts.length - 1]
  return subtype ? subtype.toUpperCase() : 'FILE'
}

function formatFileSize(size?: number) {
  if (typeof size !== 'number' || Number.isNaN(size) || size <= 0) {
    return 'Ukuran tidak tersedia'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  let value = size
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const formattedValue = value >= 10 || unitIndex === 0
    ? Math.round(value).toString()
    : value.toFixed(1)

  return `${formattedValue} ${units[unitIndex]}`
}

function formatTargetTime(targetTime?: string | null) {
  if (!targetTime) return null

  const date = new Date(targetTime)
  if (Number.isNaN(date.getTime())) return null

  const pad = (value: number) => value.toString().padStart(2, '0')

  return `${pad(date.getHours())}.${pad(date.getMinutes())}`
}

function toLocalDateTimeInputValue(targetTime?: string | null) {
  if (!targetTime) return ''

  const date = new Date(targetTime)
  if (Number.isNaN(date.getTime())) return ''

  const pad = (value: number) => value.toString().padStart(2, '0')

  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join('T')
}

function getLocalDateInputValue(localDateTime: string) {
  return localDateTime.split('T')[0] ?? ''
}

function getLocalClockInputValue(localDateTime: string) {
  return localDateTime.split('T')[1] ?? ''
}

function getClockHourValue(clockValue: string) {
  return clockValue.split(':')[0] ?? ''
}

function getClockMinuteValue(clockValue: string) {
  return clockValue.split(':')[1] ?? ''
}

function mergeLocalDateTimeInputValue(localDateTime: string, part: 'date' | 'clock', value: string) {
  const dateValue = part === 'date' ? value : getLocalDateInputValue(localDateTime)
  const clockValue = part === 'clock' ? value : getLocalClockInputValue(localDateTime)

  if (!dateValue && !clockValue) return ''

  return `${dateValue}T${clockValue}`
}

function formatTwoDigitInput(value: string) {
  return value.replace(/\D/g, '').slice(0, 2)
}

function mergeClockInputValue(clockValue: string, part: 'hour' | 'minute', value: string) {
  const hourValue = part === 'hour' ? formatTwoDigitInput(value) : getClockHourValue(clockValue)
  const minuteValue = part === 'minute' ? formatTwoDigitInput(value) : getClockMinuteValue(clockValue)

  if (!hourValue && !minuteValue) return ''

  return `${hourValue}:${minuteValue}`
}

function isValidLocalDateTimeInputValue(localDateTime: string) {
  const [dateValue = '', clockValue = ''] = localDateTime.split('T')

  return (
    /^\d{4}-\d{2}-\d{2}$/.test(dateValue) &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(clockValue)
  )
}

export function DocumentCard({
  id,
  landId,
  title,
  description,
  category,
  type,
  file,
  targetTime,
  hiddenFromOperator = false,
  onDelete,
  onVisibilityChange,
  showOperatorActions = false
}: DocumentCardProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isViewing, setIsViewing] = useState(false)
  const [isDisplaying, setIsDisplaying] = useState(false)
  const [isSavingTargetTime, setIsSavingTargetTime] = useState(false)
  const [isSavingVisibility, setIsSavingVisibility] = useState(false)
  const [currentTargetTime, setCurrentTargetTime] = useState<string | null>(targetTime ?? null)
  const [currentHiddenFromOperator, setCurrentHiddenFromOperator] = useState(hiddenFromOperator)
  const [targetTimeInput, setTargetTimeInput] = useState(() => toLocalDateTimeInputValue(targetTime))

  const [currentFileName, setCurrentFileName] = useState(file.name)
  const [isEditingFileName, setIsEditingFileName] = useState(false)
  const [fileNameInput, setFileNameInput] = useState('')
  const [isSavingFileName, setIsSavingFileName] = useState(false)

  const [currentTitle, setCurrentTitle] = useState(title)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState('')
  const [isSavingTitle, setIsSavingTitle] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const fileIconMeta = getFileIconMeta(type, currentFileName)
  const TypeIcon = fileIconMeta.Icon
  const formattedTargetTime = formatTargetTime(currentTargetTime)
  const showTargetTimeEditor = Boolean(onDelete && !showOperatorActions)
  const isAdmin = Boolean(onDelete && !showOperatorActions)
  const isTargetTimeInputValid = !targetTimeInput || isValidLocalDateTimeInputValue(targetTimeInput)
  const targetTimeError = targetTimeInput && !isTargetTimeInputValid
    ? 'Isi tanggal dan jam format 24 jam, contoh 14:30'
    : ''

  useEffect(() => {
    setCurrentTargetTime(targetTime ?? null)
    setTargetTimeInput(toLocalDateTimeInputValue(targetTime))
  }, [targetTime])

  useEffect(() => {
    setCurrentHiddenFromOperator(hiddenFromOperator)
  }, [hiddenFromOperator])

  useEffect(() => {
    setCurrentFileName(file.name)
  }, [file.name])

  useEffect(() => {
    setCurrentTitle(title)
  }, [title])

  const handleView = async () => {
    try {
      setIsViewing(true)

      // Get signed URL from API
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filePath: file.path
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate view link')
      }

      const data = await response.json()

      // Open in a new tab to display the file
      window.open(data.url, '_blank')
    } catch (error) {
      console.error('View error:', error)
      toast.error('Gagal membuka preview dokumen')
    } finally {
      setIsViewing(false)
    }
  }

  const handlePreviewClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    handleView()
  }

  const handleShowOnDisplay = async (e: React.MouseEvent) => {
    e.stopPropagation()

    try {
      setIsDisplaying(true)

      const displayDocument = {
        id,
        landId,
        title: currentTitle,
        description,
        category,
        type,
        file,
        targetTime: currentTargetTime,
        updatedAt: Date.now(),
      }

      const response = await fetch('/api/display-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(displayDocument),
      })

      if (!response.ok) {
        throw new Error('Gagal mengirim dokumen ke display')
      }

      const data = await response.json()
      const nextDisplayDocument = data.document ?? displayDocument

      window.localStorage.setItem(
        getDisplayDocumentStorageKey(nextDisplayDocument.landId),
        JSON.stringify(nextDisplayDocument)
      )

      window.dispatchEvent(
        new CustomEvent('futaba-display-document-change', {
          detail: nextDisplayDocument,
        })
      )
    } catch (error) {
      console.error('Display error:', error)
      toast.error(error instanceof Error ? error.message : 'Gagal menampilkan dokumen di display')
    } finally {
      window.setTimeout(() => setIsDisplaying(false), 600)
    }
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true)
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Gagal menghapus file')
      }

      // --- TAMBAHAN BARU: Sinyal instan ke layar Display ---
      const displayStorageKey = getDisplayDocumentStorageKey(landId)
      const rawDisplayDoc = window.localStorage.getItem(displayStorageKey)

      if (rawDisplayDoc) {
        try {
          const displayDoc = JSON.parse(rawDisplayDoc)
          if (displayDoc.id === id) {
            window.localStorage.removeItem(displayStorageKey)
            window.dispatchEvent(
              new CustomEvent('futaba-display-document-change', {
                detail: null,
              })
            )
          }
        } catch (e) {
          console.error('Error clearing display storage:', e)
        }
      }
      // -----------------------------------------------------

      setShowDeleteConfirm(false)
      toast.success(`File "${currentTitle}" berhasil dihapus.`)

      if (onDelete) {
        await onDelete(id)
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error(error instanceof Error ? error.message : 'Gagal menghapus file')
    } finally {
      setIsDeleting(false)
    }
  }

  const saveTargetTime = async (nextTargetTime: string | null) => {
    try {
      setIsSavingTargetTime(true)

      const response = await fetch(`/api/documents/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_time: nextTargetTime,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? 'Gagal menyimpan target waktu')
      }

      const data = await response.json()
      const savedTargetTime = data.document?.targetTime ?? nextTargetTime

      setCurrentTargetTime(savedTargetTime)
      setTargetTimeInput(toLocalDateTimeInputValue(savedTargetTime))
    } catch (error) {
      console.error('Target time update error:', error)
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan target waktu')
    } finally {
      setIsSavingTargetTime(false)
    }
  }

  const handleSaveTargetTime = async (e: React.MouseEvent) => {
    e.stopPropagation()

    if (targetTimeInput && !isValidLocalDateTimeInputValue(targetTimeInput)) {
      return
    }

    await saveTargetTime(
      targetTimeInput ? new Date(targetTimeInput).toISOString() : null
    )
  }

  const handleResetTargetTime = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await saveTargetTime(null)
  }

  const handleToggleOperatorVisibility = async (e: React.MouseEvent) => {
    e.stopPropagation()

    const nextHiddenFromOperator = !currentHiddenFromOperator

    try {
      setIsSavingVisibility(true)

      const response = await fetch(`/api/documents/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hidden_from_operator: nextHiddenFromOperator,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? 'Gagal mengubah visibilitas operator')
      }

      const data = await response.json()
      const savedHiddenFromOperator = Boolean(
        data.document?.hiddenFromOperator ?? nextHiddenFromOperator
      )

      setCurrentHiddenFromOperator(savedHiddenFromOperator)
      onVisibilityChange?.(id, savedHiddenFromOperator)

      if (savedHiddenFromOperator) {
        toast.success("Dokumen berhasil disembunyikan dari operator")
      } else {
        toast.success("Dokumen sekarang dapat dilihat oleh operator")
      }

      router.refresh()
    } catch (error) {
      console.error('Operator visibility update error:', error)
      toast.error(error instanceof Error ? error.message : 'Gagal mengubah visibilitas operator')
    } finally {
      setIsSavingVisibility(false)
    }
  }

  const handleSaveFileName = async () => {
    if (!fileNameInput.trim()) return

    const lastDotIndex = currentFileName.lastIndexOf('.')
    const extension = lastDotIndex !== -1 ? currentFileName.substring(lastDotIndex + 1) : ''
    const nextFileName = extension
      ? `${fileNameInput.trim()}.${extension}`
      : fileNameInput.trim()

    if (nextFileName === currentFileName) {
      setIsEditingFileName(false)
      return
    }

    try {
      setIsSavingFileName(true)

      const response = await fetch(`/api/documents/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_name: nextFileName,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? 'Gagal menyimpan nama file')
      }

      const data = await response.json()
      const savedFileName = data.document?.fileName ?? nextFileName

      setCurrentFileName(savedFileName)

      const displayStorageKey = getDisplayDocumentStorageKey(landId)
      const rawDisplayDoc = window.localStorage.getItem(displayStorageKey)
      if (rawDisplayDoc) {
        try {
          const displayDoc = JSON.parse(rawDisplayDoc)
          if (displayDoc.id === id) {
            displayDoc.file.name = savedFileName
            window.localStorage.setItem(displayStorageKey, JSON.stringify(displayDoc))
            window.dispatchEvent(
              new CustomEvent('futaba-display-document-change', {
                detail: displayDoc,
              })
            )
          }
        } catch (e) {
          console.error(e)
        }
      }

      setIsEditingFileName(false)
    } catch (error) {
      console.error('File name update error:', error)
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan nama file')
    } finally {
      setIsSavingFileName(false)
    }
  }

  const handleSaveTitle = async () => {
    if (!titleInput.trim()) return

    const nextTitle = titleInput.trim()
    if (nextTitle === currentTitle) {
      setIsEditingTitle(false)
      return
    }

    try {
      setIsSavingTitle(true)

      const response = await fetch(`/api/documents/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: nextTitle,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? 'Gagal menyimpan judul dokumen')
      }

      const data = await response.json()
      const savedTitle = data.document?.title ?? nextTitle

      setCurrentTitle(savedTitle)

      const displayStorageKey = getDisplayDocumentStorageKey(landId)
      const rawDisplayDoc = window.localStorage.getItem(displayStorageKey)
      if (rawDisplayDoc) {
        try {
          const displayDoc = JSON.parse(rawDisplayDoc)
          if (displayDoc.id === id) {
            displayDoc.title = savedTitle
            window.localStorage.setItem(displayStorageKey, JSON.stringify(displayDoc))
            window.dispatchEvent(
              new CustomEvent('futaba-display-document-change', {
                detail: displayDoc,
              })
            )
          }
        } catch (e) {
          console.error(e)
        }
      }

      setIsEditingTitle(false)
    } catch (error) {
      console.error('Title update error:', error)
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan judul dokumen')
    } finally {
      setIsSavingTitle(false)
    }
  }

  return (
    <>
      <div
        onClick={showOperatorActions ? undefined : handleView}
        className={`bg-card border rounded-lg p-4 shadow-sm hover:shadow-md active:scale-[0.99] active:shadow-sm transition-all duration-200 group select-none text-foreground ${showOperatorActions ? '' : 'cursor-pointer'
          } ${currentHiddenFromOperator
            ? 'border-amber-200 bg-amber-50/40 hover:border-amber-300'
            : 'border-border hover:border-primary'
          }`}
        title={showOperatorActions ? undefined : 'Klik kartu ini untuk melihat/membuka dokumen'}
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          {/* Main Content Area */}
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div className="flex-shrink-0">
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-lg transition-all duration-200 ${fileIconMeta.containerClassName}`}
                style={fileIconMeta.containerStyle}
              >
                <TypeIcon
                  className={`w-6 h-6 ${fileIconMeta.iconClassName}`}
                  style={fileIconMeta.iconStyle}
                />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              {isEditingTitle ? (
                <div
                  className="flex items-center gap-1.5 w-full max-w-sm mb-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="text"
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    className="h-8 px-2 flex-1 rounded border border-border bg-background text-base font-semibold text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    placeholder="Judul dokumen"
                    disabled={isSavingTitle}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveTitle()
                      } else if (e.key === 'Escape') {
                        setIsEditingTitle(false)
                      }
                    }}
                  />
                  <button
                    onClick={handleSaveTitle}
                    disabled={isSavingTitle || !titleInput.trim()}
                    className="p-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 transition-all duration-200 flex items-center justify-center"
                    title="Simpan"
                  >
                    {isSavingTitle ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => setIsEditingTitle(false)}
                    disabled={isSavingTitle}
                    className="p-1.5 bg-muted text-muted-foreground rounded hover:bg-muted/80 transition-all duration-200 flex items-center justify-center"
                    title="Batal"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <h3 className="text-lg font-semibold text-foreground truncate group-hover:text-primary transition-all duration-200 inline-flex items-center gap-1.5 max-w-full">
                  <span className="truncate">{currentTitle}</span>
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setTitleInput(currentTitle)
                        setIsEditingTitle(true)
                      }}
                      className="p-1 text-muted-foreground hover:text-primary rounded transition-all duration-200 flex-shrink-0"
                      title="Ubah judul dokumen"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </h3>
              )}
              {description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-3">
                <span
                  className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${fileIconMeta.labelClassName}`}
                  style={fileIconMeta.labelStyle}
                >
                  {getTypeLabel(type, currentFileName)}
                </span>
                {currentHiddenFromOperator && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    <EyeOff className="h-3.5 w-3.5" />
                    Disembunyikan dari operator
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {isEditingFileName ? (
                  <div
                    className="flex items-center gap-1.5 w-full"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <div className="flex flex-1 items-center gap-1 max-w-sm">
                      <input
                        type="text"
                        value={fileNameInput}
                        onChange={(e) => setFileNameInput(e.target.value)}
                        className="h-7 px-2 flex-1 rounded border border-border bg-background text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                        placeholder="Nama file"
                        disabled={isSavingFileName}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveFileName()
                          } else if (e.key === 'Escape') {
                            setIsEditingFileName(false)
                          }
                        }}
                      />
                      {currentFileName.lastIndexOf('.') !== -1 && (
                        <span className="text-xs text-muted-foreground select-none pr-1">
                          .{currentFileName.substring(currentFileName.lastIndexOf('.') + 1)}
                        </span>
                      )}
                      <button
                        onClick={handleSaveFileName}
                        disabled={isSavingFileName || !fileNameInput.trim()}
                        className="p-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 transition-all duration-200 flex items-center justify-center"
                        title="Simpan"
                      >
                        {isSavingFileName ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => setIsEditingFileName(false)}
                        disabled={isSavingFileName}
                        className="p-1.5 bg-muted text-muted-foreground rounded hover:bg-muted/80 transition-all duration-200 flex items-center justify-center"
                        title="Batal"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                      <span className="truncate">{currentFileName}</span>
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const lastDotIndex = currentFileName.lastIndexOf('.')
                            const base = lastDotIndex !== -1 ? currentFileName.substring(0, lastDotIndex) : currentFileName
                            setFileNameInput(base)
                            setIsEditingFileName(true)
                          }}
                          className="p-1 text-muted-foreground hover:text-primary rounded transition-all duration-200"
                          title="Ubah nama file"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatFileSize(file.size)}
                    </span>
                    {formattedTargetTime && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        Target {formattedTargetTime}
                      </span>
                    )}
                  </>
                )}
              </div>

              {showTargetTimeEditor && (
                <div
                  className="mt-4 flex flex-col gap-2 rounded-lg border border-border bg-muted p-3 sm:flex-row sm:items-end"
                  onClick={(event) => event.stopPropagation()}
                >
                  <label className="flex-1">
                    <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                      Target Waktu
                    </span>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        type="date"
                        value={getLocalDateInputValue(targetTimeInput)}
                        onChange={(event) => {
                          setTargetTimeInput((currentValue) =>
                            mergeLocalDateTimeInputValue(currentValue, 'date', event.target.value)
                          )
                        }}
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
                        disabled={isSavingTargetTime}
                      />
                      <div className="flex h-9 items-center rounded-lg border border-border bg-background px-2 text-sm text-foreground transition-all duration-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                        <input
                          type="text"
                          value={getClockHourValue(getLocalClockInputValue(targetTimeInput))}
                          onChange={(event) => {
                            setTargetTimeInput((currentValue) => {
                              const clockValue = mergeClockInputValue(
                                getLocalClockInputValue(currentValue),
                                'hour',
                                event.target.value
                              )

                              return mergeLocalDateTimeInputValue(currentValue, 'clock', clockValue)
                            })
                          }}
                          placeholder="HH"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={2}
                          aria-label="Jam"
                          className="h-full w-10 bg-transparent text-center outline-none placeholder:text-gray-400"
                          disabled={isSavingTargetTime}
                        />
                        <span className="px-1 font-semibold text-gray-500">:</span>
                        <input
                          type="text"
                          value={getClockMinuteValue(getLocalClockInputValue(targetTimeInput))}
                          onChange={(event) => {
                            setTargetTimeInput((currentValue) => {
                              const clockValue = mergeClockInputValue(
                                getLocalClockInputValue(currentValue),
                                'minute',
                                event.target.value
                              )

                              return mergeLocalDateTimeInputValue(currentValue, 'clock', clockValue)
                            })
                          }}
                          placeholder="MM"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={2}
                          aria-label="Menit"
                          className="h-full w-10 bg-transparent text-center outline-none placeholder:text-gray-400"
                          disabled={isSavingTargetTime}
                        />
                      </div>
                    </div>
                    {targetTimeError && (
                      <span className="mt-1 block text-xs font-medium text-red-600">
                        {targetTimeError}
                      </span>
                    )}
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveTargetTime}
                    disabled={isSavingTargetTime || !isTargetTimeInputValid}
                    className="h-9 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isSavingTargetTime ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Simpan
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleResetTargetTime}
                    disabled={isSavingTargetTime || (!currentTargetTime && !targetTimeInput)}
                    className="h-9 border-border bg-background text-foreground hover:bg-muted"
                  >
                    {isSavingTargetTime ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                    Reset
                  </Button>
                </div>
              )}
            </div>
          </div>

          {showOperatorActions && (
            <div className="grid w-full grid-cols-1 gap-2 border-t border-border pt-3 sm:flex sm:w-auto sm:flex-shrink-0 sm:self-start sm:border-t-0 sm:pt-0">
              <button
                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-sm font-semibold text-foreground sm:w-40 transition-colors duration-200 active:scale-[0.97] hover:bg-muted"
                onClick={handlePreviewClick}
                disabled={isViewing}
                title="Preview Dokumen"
                type="button"
              >
                {isViewing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                <span className="text-xs font-medium">Preview</span>
              </button>

              <button
                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 border border-emerald-600 text-sm font-semibold text-white sm:w-40 transition-colors duration-200 active:scale-[0.97] hover:bg-emerald-700"
                onClick={handleShowOnDisplay}
                disabled={isDisplaying}
                title="Tampilkan di Display"
                type="button"
              >
                {isDisplaying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MonitorUp className="w-4 h-4" />
                )}
                <span className="text-xs font-medium">Tampilkan</span>
              </button>
            </div>
          )}

          {onDelete && (
            <div className="flex gap-2 sm:flex-shrink-0 self-end sm:self-start justify-end w-full sm:w-auto border-t sm:border-t-0 border-border pt-3 sm:pt-0 mt-1 sm:mt-0">
              <Button
                size="sm"
                variant="ghost"
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 ${currentHiddenFromOperator
                  ? 'text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800'
                  : 'text-amber-700 hover:bg-amber-50 hover:text-amber-800'
                  }`}
                onClick={handleToggleOperatorVisibility}
                disabled={isSavingVisibility}
                title={currentHiddenFromOperator ? 'Tampilkan ke Operator' : 'Sembunyikan dari Operator'}
              >
                {isSavingVisibility ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : currentHiddenFromOperator ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
                <span className="sm:hidden text-xs font-medium">
                  {currentHiddenFromOperator ? 'Tampilkan' : 'Sembunyikan'}
                </span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600 hover:bg-red-50 hover:text-red-700 flex-1 sm:flex-initial flex items-center justify-center gap-1.5"
                onClick={handleDeleteClick}
                disabled={isDeleting}
                title="Hapus Dokumen"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span className="sm:hidden text-xs font-medium">Hapus</span>
              </Button>
            </div>
          )}
        </div>
      </div>
      <DeleteConfirmDialog
        isOpen={showDeleteConfirm}
        isLoading={isDeleting}
        title="Hapus File"
        description="File ini akan dihapus secara permanen dari sistem dan tidak bisa dikembalikan."
        itemName={currentTitle}
        confirmLabel="Hapus File"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!isDeleting) setShowDeleteConfirm(false)
        }}
      />
    </>
  )
}