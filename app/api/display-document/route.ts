import { prisma } from '@/lib/prisma'
import { getSocketIOServer } from '@/lib/socket'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface DisplayDocumentPayload {
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
  updatedAt: number
}

declare global {
  // eslint-disable-next-line no-var
  var futabaDisplayDocumentsByLine: Record<string, DisplayDocumentPayload | null> | undefined
}

function normalizeLineKey(lineId?: string | null): string {
  if (!lineId) return '__default__'
  return lineId.trim()
}

function getMemoryDisplayDocument(lineId?: string | null): DisplayDocumentPayload | null {
  const displayDocuments = globalThis.futabaDisplayDocumentsByLine ?? {}
  const key = normalizeLineKey(lineId)
  return (
    displayDocuments[key] ??
    displayDocuments[key.toLowerCase()] ??
    (key !== '__default__' ? displayDocuments['__default__'] : null) ??
    null
  )
}

function setMemoryDisplayDocument(lineId: string | undefined, document: DisplayDocumentPayload) {
  const key = normalizeLineKey(lineId)
  globalThis.futabaDisplayDocumentsByLine = {
    ...(globalThis.futabaDisplayDocumentsByLine ?? {}),
    [key]: document,
    ...(key !== '__default__' ? { [key.toLowerCase()]: document } : {}),
  }
}

function clearMemoryDisplayDocument(lineId?: string | null) {
  const key = normalizeLineKey(lineId)
  const current = { ...(globalThis.futabaDisplayDocumentsByLine ?? {}) }
  delete current[key]
  if (key !== '__default__') {
    delete current[key.toLowerCase()]
  }
  globalThis.futabaDisplayDocumentsByLine = current
}

function isDisplayDocument(value: unknown): value is Omit<DisplayDocumentPayload, 'updatedAt'> {
  if (!value || typeof value !== 'object') return false

  const document = value as Partial<DisplayDocumentPayload>

  return (
    typeof document.id === 'string' &&
    typeof document.title === 'string' &&
    Boolean(
      document.file &&
      typeof document.file === 'object' &&
      typeof document.file.name === 'string' &&
      typeof document.file.path === 'string'
    )
  )
}

async function getDatabaseDisplayDocument(lineId: string | null) {
  const memoryDoc = getMemoryDisplayDocument(lineId)

  if (!lineId) {
    return { document: memoryDoc, hasDatabase: false }
  }

  try {
    const data = await prisma.displayDocument.findUnique({
      where: { line_id: lineId.trim() },
      include: { document: true },
    })

    if (!data || !data.document) {
      // Fallback ke memory jika data DB belum ada atau relasi kosong
      return { document: memoryDoc, hasDatabase: true }
    }

    const doc = data.document
    const payload: DisplayDocumentPayload = {
      id: doc.id,
      lineId: doc.line_id ?? lineId.trim(),
      title: doc.title,
      description: doc.description ?? undefined,
      type: doc.file_type ?? 'application/pdf',
      file: {
        name: doc.file_name,
        path: doc.file_path,
        size: doc.file_size ? Number(doc.file_size) : undefined,
      },
      targetTime: doc.target_time ? doc.target_time.toISOString() : null,
      updatedAt: data.updated_at.getTime(),
    }

    // Selaraskan state memory dengan DB
    setMemoryDisplayDocument(lineId, payload)
    return { document: payload, hasDatabase: true }
  } catch (error) {
    console.warn('display_documents table lookup warn:', error)
    return { document: memoryDoc, hasDatabase: false }
  }
}

async function saveDatabaseDisplayDocument(
  lineId: string | undefined,
  document: DisplayDocumentPayload
) {
  setMemoryDisplayDocument(lineId, document)

  if (!lineId) return { hasDatabase: false }

  try {
    await prisma.displayDocument.upsert({
      where: { line_id: lineId.trim() },
      create: {
        line_id: lineId.trim(),
        document_id: document.id,
      },
      update: {
        document_id: document.id,
      },
    })
    return { hasDatabase: true }
  } catch (error) {
    console.warn('display_documents upsert warn:', error)
    return { hasDatabase: false }
  }
}

async function clearDatabaseDisplayDocument(lineId: string | null | undefined) {
  clearMemoryDisplayDocument(lineId)

  if (!lineId) return { hasDatabase: false }

  try {
    await prisma.displayDocument.update({
      where: { line_id: lineId.trim() },
      data: { document_id: null },
    }).catch(() => {/* ok if not found */})
    return { hasDatabase: true }
  } catch (error) {
    console.warn('display_documents delete warn:', error)
    return { hasDatabase: false }
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const lineId = searchParams.get('lineId') ?? searchParams.get('landId')
    const result = await getDatabaseDisplayDocument(lineId)
    const document = result.document

    return NextResponse.json(
      { document },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    )
  } catch (error) {
    console.error('Display document GET error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!isDisplayDocument(body)) {
      return NextResponse.json(
        { error: 'Invalid display document payload' },
        { status: 400 }
      )
    }

    const lineId = body.lineId ? String(body.lineId).trim() : undefined
    const updatedAt = Date.now()

    const nextDocument: DisplayDocumentPayload = {
      id: body.id,
      lineId,
      title: body.title,
      description: body.description ?? undefined,
      category: body.category ?? undefined,
      type: body.type || 'application/pdf',
      file: {
        name: body.file.name,
        path: body.file.path,
        size: typeof body.file.size === 'number' ? body.file.size : undefined,
      },
      targetTime: body.targetTime ?? null,
      updatedAt,
    }

    const saveResult = await saveDatabaseDisplayDocument(lineId, nextDocument)

    if (!saveResult.hasDatabase) {
      console.warn('display_documents table is missing; using in-memory display state')
    }

    // ─── Broadcast via Socket.io ke TV Display ───────────────────────────
    try {
      const io = getSocketIOServer()
      if (io) {
        if (lineId) {
          io.to(`line:${lineId}`).emit('display:document:change', nextDocument)
          io.to(`line:${lineId.toLowerCase()}`).emit('display:document:change', nextDocument)
        }
        io.emit('display:document:change', nextDocument)
      }
    } catch (socketErr) {
      console.warn('Socket.io broadcast display:document:change warning:', socketErr)
    }

    return NextResponse.json({
      success: true,
      document: nextDocument,
    })
  } catch (error) {
    console.error('Display document handler error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const lineId = (searchParams.get('lineId') ?? searchParams.get('landId'))?.trim()
    const clearResult = await clearDatabaseDisplayDocument(lineId)

    if (!clearResult.hasDatabase) {
      console.warn('display_documents table is missing; cleared in-memory display state')
    }

    // ─── Broadcast clear event via Socket.io ─────────────────────────────
    try {
      const io = getSocketIOServer()
      if (io) {
        if (lineId) {
          io.to(`line:${lineId}`).emit('display:document:clear', { lineId })
          io.to(`line:${lineId.toLowerCase()}`).emit('display:document:clear', { lineId })
        }
        io.emit('display:document:clear', { lineId })
      }
    } catch (socketErr) {
      console.warn('Socket.io broadcast display:document:clear warning:', socketErr)
    }

    return NextResponse.json({
      success: true,
      document: null,
    })
  } catch (error) {
    console.error('Display document DELETE error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
