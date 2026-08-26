import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
  updatedAt: number
}

declare global {
  // eslint-disable-next-line no-var
  var futabaDisplayDocumentsByLine: Record<string, DisplayDocument | null> | undefined
}

const LEGACY_DISPLAY_LINE_KEY = '__default__'

function getDisplayLineKey(lineId?: string | null) {
  return lineId || LEGACY_DISPLAY_LINE_KEY
}

function getMemoryDisplayDocument(lineId?: string | null) {
  const displayDocuments = globalThis.futabaDisplayDocumentsByLine ?? {}
  return displayDocuments[getDisplayLineKey(lineId)] ?? null
}

function setMemoryDisplayDocument(lineId: string | undefined, document: DisplayDocument) {
  globalThis.futabaDisplayDocumentsByLine = {
    ...(globalThis.futabaDisplayDocumentsByLine ?? {}),
    [getDisplayLineKey(lineId)]: document,
  }
}

function clearMemoryDisplayDocument(lineId?: string | null) {
  globalThis.futabaDisplayDocumentsByLine = {
    ...(globalThis.futabaDisplayDocumentsByLine ?? {}),
    [getDisplayLineKey(lineId)]: null,
  }
}

function toIsoDateTime(value: number) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

function toUpdatedAt(value?: string | null) {
  if (!value) return Date.now()

  const time = new Date(value).getTime()
  return Number.isNaN(time) ? Date.now() : time
}

function isMissingDisplayTableError(error: { code?: string; message?: string } | null) {
  return (
    error?.code === '42P01' ||
    error?.message?.toLowerCase().includes('display_documents') === true
  )
}

async function getDocumentTargetTime(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('documents')
    .select('target_time')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Display target time lookup error:', error)
    return undefined
  }

  return data?.target_time ?? null
}

async function getDatabaseDisplayDocument(lineId: string | null) {
  const supabase = await createClient()
  const lineKey = getDisplayLineKey(lineId)

  const { data, error } = await supabase
    .from('display_documents')
    .select('document, updated_at')
    .eq('line_key', lineKey)
    .maybeSingle()

  if (error) {
    if (isMissingDisplayTableError(error)) {
      return { document: getMemoryDisplayDocument(lineId), hasDatabase: false }
    }

    throw error
  }

  if (!data?.document || !isDisplayDocument(data.document)) {
    return { document: null, hasDatabase: true }
  }

  return {
    document: {
      ...data.document,
      updatedAt: toUpdatedAt(data.updated_at),
    },
    hasDatabase: true,
  }
}

async function saveDatabaseDisplayDocument(
  lineId: string | undefined,
  document: DisplayDocument
) {
  const supabase = await createClient()
  const lineKey = getDisplayLineKey(lineId)

  const { error } = await supabase
    .from('display_documents')
    .upsert(
      {
        line_key: lineKey,
        line_id: lineId || null,
        document,
        updated_at: toIsoDateTime(document.updatedAt),
      },
      {
        onConflict: 'line_key',
      }
    )

  if (error) {
    if (isMissingDisplayTableError(error)) {
      setMemoryDisplayDocument(lineId, document)
      return { hasDatabase: false }
    }

    throw error
  }

  return { hasDatabase: true }
}

async function clearDatabaseDisplayDocument(lineId: string | null) {
  const supabase = await createClient()
  const lineKey = getDisplayLineKey(lineId)

  const { error } = await supabase
    .from('display_documents')
    .delete()
    .eq('line_key', lineKey)

  if (error) {
    if (isMissingDisplayTableError(error)) {
      clearMemoryDisplayDocument(lineId)
      return { hasDatabase: false }
    }

    throw error
  }

  clearMemoryDisplayDocument(lineId)
  return { hasDatabase: true }
}

function isDisplayDocument(value: unknown): value is Omit<DisplayDocument, 'updatedAt'> {
  if (!value || typeof value !== 'object') return false

  const document = value as Partial<DisplayDocument>

  return (
    typeof document.id === 'string' &&
    (typeof document.lineId === 'undefined' || typeof document.lineId === 'string') &&
    typeof document.title === 'string' &&
    typeof document.type === 'string' &&
    typeof document.file?.name === 'string' &&
    typeof document.file?.path === 'string' &&
    (typeof document.description === 'undefined' || typeof document.description === 'string') &&
    (typeof document.category === 'undefined' || typeof document.category === 'string') &&
    (
      typeof document.targetTime === 'undefined' ||
      document.targetTime === null ||
      typeof document.targetTime === 'string'
    ) &&
    (typeof document.file.size === 'undefined' || typeof document.file.size === 'number')
  )
}

function getRequestedAt(value: unknown) {
  if (!value || typeof value !== 'object') return Date.now()

  const document = value as Partial<DisplayDocument>
  return typeof document.updatedAt === 'number' && Number.isFinite(document.updatedAt)
    ? document.updatedAt
    : Date.now()
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const lineId = searchParams.get('lineId') ?? searchParams.get('landId')
    const result = await getDatabaseDisplayDocument(lineId)
    let document = result.document

    if (document) {
      const targetTime = await getDocumentTargetTime(document.id)
      if (typeof targetTime !== 'undefined' && targetTime !== document.targetTime) {
        document = {
          ...document,
          targetTime,
          updatedAt: Date.now(),
        }

        if (result.hasDatabase) {
          await saveDatabaseDisplayDocument(document.lineId, document)
        } else {
          setMemoryDisplayDocument(document.lineId, document)
        }
      }
    }

    return NextResponse.json({
      document,
    })
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

    const targetTime = body.targetTime ?? await getDocumentTargetTime(body.id)
    const requestedAt = getRequestedAt(body)
    const lineId = body.lineId
    const currentResult = await getDatabaseDisplayDocument(lineId ?? null)
    const currentDocument = currentResult.document

    if (currentDocument && requestedAt < currentDocument.updatedAt) {
      return NextResponse.json({
        success: true,
        document: currentDocument,
      })
    }

    const nextDocument: DisplayDocument = {
      id: body.id,
      lineId,
      title: body.title,
      description: body.description,
      category: body.category,
      type: body.type,
      file: {
        name: body.file.name,
        path: body.file.path,
        size: body.file.size,
      },
      targetTime,
      updatedAt: requestedAt,
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
