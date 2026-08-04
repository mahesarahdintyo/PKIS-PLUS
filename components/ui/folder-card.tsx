'use client'

import { Folder, Trash2, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog'
import { toast } from 'sonner'

interface FolderCardProps {
  id: number
  name: string
  itemCount?: number
  onEnter: (id: number, name: string) => void
  onDeleteSuccess?: () => void
}

export function FolderCard({
  id,
  name,
  itemCount,
  onEnter,
  onDeleteSuccess
}: FolderCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const canDelete = typeof onDeleteSuccess === 'function'
  const hasContent = typeof itemCount === 'number' && itemCount > 0

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!canDelete) return
    setShowConfirm(true)
  }

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true)

      const response = await fetch(`/api/folders?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Gagal menghapus folder')
      }

      setShowConfirm(false)

      if (hasContent) {
        toast.success(`Folder "${name}" dan ${itemCount} isinya berhasil dihapus.`, {
          duration: 4000,
        })
      } else {
        toast.success(`Folder "${name}" berhasil dihapus.`)
      }

      onDeleteSuccess!()
    } catch (error) {
      console.error('Delete folder error:', error)
      toast.error(error instanceof Error ? error.message : 'Gagal menghapus folder')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div
        onClick={() => onEnter(id, name)}
        className="bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md hover:border-primary active:scale-[0.99] active:shadow-sm transition-all duration-200 cursor-pointer group flex items-center justify-between text-foreground min-w-0"
        title={`Klik untuk masuk ke folder ${name}`}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 bg-yellow-100 rounded-lg flex items-center justify-center group-hover:bg-yellow-200 transition-all duration-200">
            <Folder className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 fill-yellow-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-sm sm:text-base text-foreground truncate group-hover:text-primary transition-all duration-200">
              {name}
            </h4>
            <p className="text-xs text-muted-foreground">
              {typeof itemCount === 'number' ? `${itemCount} isi` : 'Folder'}
            </p>
          </div>
        </div>

        {canDelete && (
          <Button
            size="sm"
            variant="ghost"
            className="text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
            onClick={handleDeleteClick}
            disabled={isDeleting}
            title="Hapus Folder"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>

      <DeleteConfirmDialog
        isOpen={showConfirm}
        isLoading={isDeleting}
        title="Hapus Folder"
        description={
          hasContent
            ? `Folder ini berisi ${itemCount} item. Semua file dan sub-folder di dalamnya akan ikut terhapus secara permanen.`
            : 'Folder ini akan dihapus secara permanen dari sistem.'
        }
        itemName={name}
        confirmLabel="Hapus Folder"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!isDeleting) setShowConfirm(false)
        }}
      />
    </>
  )
}
