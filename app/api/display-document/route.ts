import { prisma } from '@/lib/prisma'
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

function getMemoryDisplayDocument(lineId?: string | null) {
  const displayDocuments = globalThis.futabaDisplayDocumentsByLine ?? {}
  return displayDocuments[lineId || '__default__'] ?? null
}

function setMemoryDisplayDocument(lineId: string | undefined, document: DisplayDocumentPayload) {
  globalThis.futabaDisplayDocumentsByLine = {
    ...(globalThis.futabaDisplayDocumentsByLine ?? {}),
    [lineId || '__default__']: document,
  }
}

function clearMemoryDisplayDocument(lineId?: string | null) {
  globalThis.futabaDisplayDocumentsByLine = {
    ...(globalThis.futabaDisplayDocumentsByLine ?? {}),
    [lineId || '__default__']: null,
  }
}

function isDisplayDocument(value: unknown): value is Omit<DisplayDocumentPayload, 'updatedAt'> {
  if (!value || typeof value !== 'object') return false

  const document = value as Partial<DisplayDocumentPayload>

  return (
    typeof document.id === 'string' &&
    typeof document.title === 'string' &&
    typeof document.type === 'string' &&
    Boolean(document.file && typeof document.file === 'object' && typeof document.file.name === 'string' && typeof document.file.path === 'string')
  )
}

async function getDatabaseDisplayDocument(lineId: string | null) {
  if (!lineId) {
    return { document: getMemoryDisplayDocument(lineId), hasDatabase: false }
  }

  try {
    const data = await prisma.displayDocument.findUnique({
      where: { line_id: lineId },
      include: { document: true },
    })

    if (!data || !data.document) {
      return { document: null, hasDatabase: true }
    }

    const doc = data.document
    const payload: DisplayDocumentPayload = {
      id: doc.id,
      lineId: doc.line_id ?? undefined,
      title: doc.title,
      description: doc.description ?? undefined,
      type: doc.file_type ?? 'application/octet-stream',
      file: {
        name: doc.file_name,
        path: doc.file_path,
        size: doc.file_size ? Number(doc.file_size) : undefined,
      },
      targetTime: doc.target_time ? doc.target_time.toISOString() : null,
      updatedAt: data.updated_at.getTime(),
    }
    return { document: payload, hasDatabase: true }
  } catch (error) {
    console.warn('display_documents table lookup warn:', error)
    return { document: getMemoryDisplayDocument(lineId), hasDatabase: false }
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
      where: { line_id: lineId },
      create: {
        line_id: lineId,
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

async function clearDatabaseDisplayDocument(lineId: string | null) {
  clearMemoryDisplayDocument(lineId)

  if (!lineId) return { hasDatabase: false }

  try {
    await prisma.displayDocument.update({
      where: { line_id: lineId },
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

    const lineId = body.lineId ? String(body.lineId) : undefined
    const updatedAt = Date.now()

    const nextDocument: DisplayDocumentPayload = {
      id: body.id,
      lineId,
      title: body.title,
      description: body.description ?? undefined,
      category: body.category ?? undefined,
      type: body.type,
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
    const lineId = searchParams.get('lineId') ?? searchParams.get('landId')
    const clearResult = await clearDatabaseDisplayDocument(lineId)

    if (!clearResult.hasDatabase) {
      console.warn('display_documents table is missing; cleared in-memory display state')
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
