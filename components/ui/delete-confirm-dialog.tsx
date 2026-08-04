'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DeleteConfirmDialogProps {
  isOpen: boolean
  isLoading?: boolean
  title: string
  description?: string
  itemName: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmDialog({
  isOpen,
  isLoading = false,
  title,
  description,
  itemName,
  confirmLabel = 'Hapus',
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  const [isVisible, setIsVisible] = useState(isOpen)
  const [isClosing, setIsClosing] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false)
      setIsVisible(true)
    } else if (isVisible) {
      setIsClosing(true)
      const timer = setTimeout(() => {
        setIsVisible(false)
        setIsClosing(false)
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [isVisible])

  if (!isVisible || !mounted) return null

  const dialogContent = (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px] ${
        isClosing
          ? 'animate-out fade-out duration-200 [animation-fill-mode:forwards]'
          : 'animate-in fade-in duration-200'
      }`}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onCancel()
      }}
    >
      <div className={`bg-white rounded-xl shadow-2xl max-w-md w-full ${
        isClosing
          ? 'animate-out fade-out zoom-out-95 duration-200 [animation-fill-mode:forwards]'
          : 'animate-in fade-in zoom-in-95 duration-200'
      }`}>
        {/* Icon + Judul */}
        <div className="flex items-start gap-4 px-6 pt-6 pb-4">
          <div className="flex-shrink-0 w-11 h-11 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {description && (
              <p className="mt-1 text-sm text-gray-500 leading-relaxed">{description}</p>
            )}
          </div>
        </div>

        {/* Nama item yang akan dihapus */}
        <div className="mx-6 mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800 font-medium truncate">
            &ldquo;{itemName}&rdquo;
          </p>
        </div>

        {/* Catatan peringatan */}
        <p className="mx-6 mb-5 text-xs text-gray-400">
          Tindakan ini tidak dapat dibatalkan.
        </p>

        {/* Tombol aksi */}
        <div className="flex gap-3 px-6 pb-6">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900"
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Menghapus...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                {confirmLabel}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )

  return createPortal(dialogContent, document.body)
}
