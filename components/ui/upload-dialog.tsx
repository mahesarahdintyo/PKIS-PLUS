'use client'

import { useState } from 'react'
import { Upload, X, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const ALLOWED_FILE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png']
const ALLOWED_FILE_FORMAT_LABEL = 'PDF, JPG, JPEG, atau PNG'
const MAX_FILE_COUNT = 5

interface UploadDialogProps {
  folderId: number | null
  landId: string
  onUploadSuccess?: () => void
  onOpenChange?: (open: boolean) => void
}

function formatTwoDigitInput(value: string) {
  return value.replace(/\D/g, '').slice(0, 2)
}

function getClockHourValue(clockValue: string) {
  return clockValue.split(':')[0] ?? ''
}

function getClockMinuteValue(clockValue: string) {
  return clockValue.split(':')[1] ?? ''
}

function mergeClockInputValue(clockValue: string, part: 'hour' | 'minute', value: string) {
  const hourValue = part === 'hour' ? formatTwoDigitInput(value) : getClockHourValue(clockValue)
  const minuteValue = part === 'minute' ? formatTwoDigitInput(value) : getClockMinuteValue(clockValue)

  if (!hourValue && !minuteValue) return ''

  return `${hourValue}:${minuteValue}`
}

function isAllowedFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const hasAllowedExtension = ALLOWED_FILE_EXTENSIONS.includes(extension)
  const hasAllowedType = file.type ? ALLOWED_FILE_TYPES.includes(file.type) : true

  return hasAllowedExtension && hasAllowedType
}

export function UploadDialog({
  folderId,
  landId,
  onUploadSuccess,
  onOpenChange
}: UploadDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [targetClock, setTargetClock] = useState('')
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const handleOpen = () => {
    setIsOpen(true)
    onOpenChange?.(true)
  }

  const handleClose = () => {
    if (isLoading) return
    setIsOpen(false)
    onOpenChange?.(false)
  }

  const isValidTargetClock = /^([01]\d|2[0-3]):[0-5]\d$/.test(targetClock)
  const isTargetTimeValid = (!targetDate && !targetClock) || (Boolean(targetDate) && isValidTargetClock)

  const addFiles = (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return
    setError('')

    if (files.length + selectedFiles.length > MAX_FILE_COUNT) {
      setError(`Maksimal upload adalah ${MAX_FILE_COUNT} file sekaligus.`)
      return
    }

    const validFiles: File[] = []
    for (const selectedFile of selectedFiles) {
      if (!isAllowedFile(selectedFile)) {
        setError(`Format file tidak diperbolehkan. Upload hanya menerima file ${ALLOWED_FILE_FORMAT_LABEL}.`)
        return
      }

      if (selectedFile.size > 50 * 1024 * 1024) {
        setError(`Ukuran file "${selectedFile.name}" melebihi batas 50MB.`)
        return
      }
      validFiles.push(selectedFile)
    }

    const nextFiles = [...files, ...validFiles]
    setFiles(nextFiles)

    if (nextFiles.length === 1) {
      const defaultTitle = nextFiles[0].name.substring(0, nextFiles[0].name.lastIndexOf('.')) || nextFiles[0].name
      setTitle(defaultTitle)
    } else {
      setTitle('')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : []
    addFiles(selectedFiles)
    e.target.value = ''
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isLoading) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (isLoading) return

    const droppedFiles = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : []
    addFiles(droppedFiles)
  }

  const handleRemoveFile = (indexToRemove: number) => {
    const nextFiles = files.filter((_, index) => index !== indexToRemove)
    setFiles(nextFiles)
    setError('')

    if (nextFiles.length === 1) {
      const defaultTitle = nextFiles[0].name.substring(0, nextFiles[0].name.lastIndexOf('.')) || nextFiles[0].name
      setTitle(defaultTitle)
    } else {
      setTitle('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (files.length === 0) {
      setError('Silakan pilih minimal 1 file.')
      return
    }

    if (files.length === 1 && !title) {
      setError('Judul dokumen tidak boleh kosong')
      return
    }

    if ((targetDate || targetClock) && (!targetDate || !isValidTargetClock)) {
      setError('Target waktu harus diisi dengan tanggal dan jam format 24 jam, contoh 14:30')
      return
    }

    try {
      setIsLoading(true)

      for (let i = 0; i < files.length; i++) {
        const fileToUpload = files[i]

        let fileTitle = title
        if (files.length > 1) {
          fileTitle = fileToUpload.name.substring(0, fileToUpload.name.lastIndexOf('.')) || fileToUpload.name
        }

        const formData = new FormData()
        formData.append('file', fileToUpload)
        formData.append('title', fileTitle)
        formData.append('description', description)
        formData.append('landId', landId)
        if (targetDate && isValidTargetClock) {
          formData.append('targetTime', new Date(`${targetDate}T${targetClock}`).toISOString())
        }
        if (folderId !== null) {
          formData.append('folderId', folderId.toString())
        }

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(`Gagal mengunggah "${fileToUpload.name}": ${data.error || 'Upload failed'}`)
        }
      }

      // Reset form
      const uploadedCount = files.length
      const uploadedTitle = files.length === 1 ? title : `${files.length} file`
      setFiles([])
      setTitle('')
      setDescription('')
      setTargetDate('')
      setTargetClock('')
      setIsOpen(false)
      onOpenChange?.(false)

      if (uploadedCount === 1) {
        toast.success(`Dokumen "${uploadedTitle}" berhasil diupload!`)
      } else {
        toast.success(`${uploadedCount} dokumen berhasil diupload!`)
      }

      if (onUploadSuccess) {
        onUploadSuccess()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Button
        onClick={handleOpen}
        className="bg-green-600 hover:bg-green-700 w-full sm:w-auto flex items-center justify-center h-9 px-4 rounded-lg text-white text-sm font-medium"
      >
        <Upload className="w-4 h-4 mr-2" />
        Upload Document
      </Button>

      {isOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/50 backdrop-blur-[2px]"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Upload Document
              </h2>
              <button
                onClick={handleClose}
                disabled={isLoading}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {files.length <= 1 ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., SOP Customer Service"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    disabled={isLoading}
                  />
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-xs">
                  <p className="font-medium">Mengunggah {files.length} file sekaligus</p>
                  <p className="mt-0.5 text-blue-600">Judul dokumen masing-masing file akan otomatis menggunakan nama file asli (tanpa ekstensi).</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description of the document"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Waktu
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    disabled={isLoading}
                  />
                  <div className="flex h-10 items-center rounded-lg border border-gray-300 bg-white px-2 text-gray-900 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500">
                    <input
                      type="text"
                      value={getClockHourValue(targetClock)}
                      onChange={(e) => setTargetClock((currentValue) =>
                        mergeClockInputValue(currentValue, 'hour', e.target.value)
                      )}
                      placeholder="HH"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={2}
                      aria-label="Jam"
                      className="h-full w-10 bg-transparent text-center outline-none placeholder:text-gray-400"
                      disabled={isLoading}
                    />
                    <span className="px-1 font-semibold text-gray-500">:</span>
                    <input
                      type="text"
                      value={getClockMinuteValue(targetClock)}
                      onChange={(e) => setTargetClock((currentValue) =>
                        mergeClockInputValue(currentValue, 'minute', e.target.value)
                      )}
                      placeholder="MM"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={2}
                      aria-label="Menit"
                      className="h-full w-10 bg-transparent text-center outline-none placeholder:text-gray-400"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File * <span className="text-xs font-normal text-gray-500">(Maksimal {MAX_FILE_COUNT} file)</span>
                </label>
                <div
                  className={`border-2 border-dashed rounded-lg p-4 text-center transition ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50/50 dark:border-blue-400 dark:bg-blue-950/20'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-input"
                    disabled={isLoading}
                  />
                  <label htmlFor="file-input" className="cursor-pointer block w-full h-full">
                    <div className="text-sm text-gray-600">
                      {isDragging ? (
                        <p className="font-medium text-blue-600 dark:text-blue-400 animate-pulse">Lepaskan file di sini</p>
                      ) : (
                        <>
                          <p className="font-medium">Click to select files</p>
                          <p className="text-gray-500">or drag and drop</p>
                        </>
                      )}
                    </div>
                  </label>
                </div>

                {files.length > 0 && (
                  <div className="mt-3 space-y-2 max-h-36 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                    {files.map((f, index) => (
                      <div key={index} className="flex items-center justify-between text-sm text-gray-700 bg-white p-2 rounded border border-gray-100">
                        <div className="truncate flex-1 pr-2">
                          <p className="font-medium truncate text-xs text-gray-900">{f.name}</p>
                          <p className="text-[10px] text-gray-500">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(index)}
                          className="text-red-500 hover:text-red-700 disabled:opacity-50 p-1 hover:bg-red-50 rounded"
                          disabled={isLoading}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isLoading}
                  className="flex-1 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-lg py-2 text-sm font-medium transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={isLoading || files.length === 0 || (files.length === 1 && !title) || !isTargetTimeValid}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Upload'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
