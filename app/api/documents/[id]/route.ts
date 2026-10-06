import { prisma } from '@/lib/prisma'
import { getCurrentUserProfile } from '@/lib/services/auth-server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const userProfile = await getCurrentUserProfile()
    if (!userProfile.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
    const linkPartNumberId = body.linkPartNumberId
    const unlinkPartNumberId = body.unlinkPartNumberId

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

    if (typeof fileName !== 'undefined' && typeof fileName !== 'string') {
      return NextResponse.json(
        { error: 'File name must be a string' },
        { status: 400 }
      )
    }

    if (typeof title !== 'undefined' && typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Title must be a string' },
        { status: 400 }
      )
    }

    if (typeof linkPartNumberId !== 'undefined' && typeof linkPartNumberId !== 'string') {
      return NextResponse.json(
        { error: 'linkPartNumberId must be a string' },
        { status: 400 }
      )
    }

    if (typeof unlinkPartNumberId !== 'undefined' && typeof unlinkPartNumberId !== 'string') {
      return NextResponse.json(
        { error: 'unlinkPartNumberId must be a string' },
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

    if (
      Object.keys(updateFields).length === 0 &&
      !linkPartNumberId &&
      !unlinkPartNumberId
    ) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    let documentData: any = null

    if (Object.keys(updateFields).length > 0) {
      documentData = await prisma.document.update({
        where: { id },
        data: updateFields,
        select: {
          id: true,
          target_time: true,
          hidden_from_operator: true,
          file_name: true,
          title: true,
        },
      })
    }

    if (linkPartNumberId) {
      await prisma.prodPartNumber.update({
        where: { id: linkPartNumberId },
        data: { document_id: id },
      })
    }

    if (unlinkPartNumberId) {
      await prisma.prodPartNumber.updateMany({
        where: { id: unlinkPartNumberId, document_id: id },
        data: { document_id: null },
      })
    }

    const linkedParts = await prisma.prodPartNumber.findMany({
      where: { document_id: id, is_active: true },
      select: { id: true, value: true },
    })

    const linkedPartNumbers = linkedParts.map((p) => ({
      id: p.id,
      value: p.value || '-',
    }))

    return NextResponse.json({
      success: true,
      document: documentData
        ? {
            id: documentData.id,
            targetTime: documentData.target_time,
            hiddenFromOperator: documentData.hidden_from_operator,
            fileName: documentData.file_name,
            title: documentData.title,
            linkedPartNumbers,
          }
        : {
            id,
            linkedPartNumbers,
          },
    })
  } catch (error: any) {
    console.error('Documents PATCH error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
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

    const doc = await prisma.document.findUnique({
      where: { id },
    })

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json(doc)
  } catch (error: any) {
    console.error('Documents GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
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

    const userProfile = await getCurrentUserProfile()
    if (!userProfile.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Hapus referensi dari layar display
    await prisma.displayDocument.deleteMany({
      where: { document_id: id },
    })

    // Soft delete document record (update is_active = false)
    await prisma.document.update({
      where: { id },
      data: { is_active: false },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Documents DELETE error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}