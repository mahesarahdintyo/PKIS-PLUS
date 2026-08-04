import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    const targetTime = body.target_time
    const hiddenFromOperator = body.hidden_from_operator
    const fileName = body.file_name
    const title = body.title

    if (
      typeof targetTime !== 'undefined' &&
      targetTime !== null &&
      typeof targetTime !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Target time must be a string or null' },
        { status: 400 }
      )
    }

    if (
      typeof hiddenFromOperator !== 'undefined' &&
      typeof hiddenFromOperator !== 'boolean'
    ) {
      return NextResponse.json(
        { error: 'Hidden from operator must be a boolean' },
        { status: 400 }
      )
    }

    if (
      typeof fileName !== 'undefined' &&
      typeof fileName !== 'string'
    ) {
      return NextResponse.json(
        { error: 'File name must be a string' },
        { status: 400 }
      )
    }

    if (
      typeof title !== 'undefined' &&
      typeof title !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Title must be a string' },
        { status: 400 }
      )
    }

    const updateFields: {
      target_time?: string | null
      hidden_from_operator?: boolean
      file_name?: string
      title?: string
    } = {}

    if (typeof targetTime !== 'undefined') {
      updateFields.target_time = targetTime || null
    }

    if (typeof hiddenFromOperator !== 'undefined') {
      updateFields.hidden_from_operator = hiddenFromOperator
    }

    if (typeof fileName !== 'undefined') {
      updateFields.file_name = fileName
    }

    if (typeof title !== 'undefined') {
      updateFields.title = title
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        { error: 'No document fields to update' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Mengganti .single() dengan .select() agar aman dari error single row coercion
    const { data: rawData, error } = await supabase
      .from('documents')
      .update(updateFields)
      .eq('id', id)
      .select('id, target_time, hidden_from_operator, file_name, title')

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    const data = Array.isArray(rawData) ? rawData[0] : rawData

    if (!data) {
      return NextResponse.json(
        { error: 'Document not found or update failed' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      document: {
        id: data.id,
        targetTime: data.target_time,
        hiddenFromOperator: data.hidden_from_operator,
        fileName: data.file_name,
        title: data.title,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // --- Hapus referensi dari layar display agar langsung hilang di layar TV ---
    await supabase.from('display_documents').delete().eq('document_id', id)
    
    // (Fail-safe) Jika skema menggunakan format JSON (document->>id)
    await supabase.from('display_documents').delete().eq('document->>id', id)
    // ---------------------------------------------------------

    // Soft delete document record (update is_active = false)
    const { error: deleteError } = await supabase
      .from('documents')
      .update({ is_active: false })
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}