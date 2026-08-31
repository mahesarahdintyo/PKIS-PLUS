import { createClient } from '@/lib/supabase/server'
import { getCurrentUserProfile } from '@/lib/services/auth-server'
import { NextResponse } from 'next/server'

const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const ALLOWED_FILE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png']
const ALLOWED_FILE_FORMAT_LABEL = 'PDF, JPG, JPEG, atau PNG'

function isAllowedFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const hasAllowedExtension = ALLOWED_FILE_EXTENSIONS.includes(extension)
  const hasAllowedType = file.type ? ALLOWED_FILE_TYPES.includes(file.type) : true

  return hasAllowedExtension && hasAllowedType
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const folderId = formData.get('folderId') as string
    const reqLineId = (formData.get('lineId') ?? formData.get('landId')) as string
    const targetTime = formData.get('targetTime') as string | null

    const userProfile = await getCurrentUserProfile()
    if (!userProfile.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const lineId = userProfile.role === 'operator' && userProfile.lineId ? userProfile.lineId : reqLineId

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!isAllowedFile(file)) {
      return NextResponse.json(
        { error: `Format file tidak diperbolehkan. Upload hanya menerima file ${ALLOWED_FILE_FORMAT_LABEL}.` },
        { status: 400 }
      )
    }

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Check if storage bucket exists, if not it will be created automatically
    // Sanitize file name: keep only alphanumeric, dot, dash, underscore to prevent path traversal
    const rawName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const fileName = `${Date.now()}-${rawName}`
    const filePath = `documents/${fileName}`

    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      )
    }

    // Create document record in database
    const payload = {
      title,
      description,
      folder_id: folderId ? parseInt(folderId) : null,
      line_id: lineId || null,
      file_name: file.name,
      file_path: uploadData.path,
      file_size: file.size,
      file_type: file.type,
      target_time: targetTime || null,
    }

    const { data: docData, error: dbError } = await supabase
      .from('documents')
      .insert(payload)
      .select()

    if (dbError) {
      // Delete the uploaded file if database insert fails
      await supabase.storage
        .from('documents')
        .remove([filePath])

      return NextResponse.json(
        { error: dbError.message },
        { status: 500 }
      )
    }

    const uploadedDoc = docData[0]
    const partNumberId = formData.get('partNumberId') as string | null
    const newPartNumberValue = formData.get('newPartNumberValue') as string | null

    if (uploadedDoc?.id) {
      if (partNumberId) {
        const { error: updatePartErr } = await supabase
          .from('prod_part_numbers' as any)
          .update({ document_id: uploadedDoc.id })
          .eq('id', partNumberId)

        if (updatePartErr) {
          console.error('Gagal menghubungkan dokumen ke part number:', updatePartErr)
        }
      } else if (newPartNumberValue && newPartNumberValue.trim()) {
        // Determine mesin for the line using the exact getMachineConfig matching logic
        let mesin = ''
        if (lineId) {
          const { data: lineRow } = await supabase
            .from('lines')
            .select('name, machine_type')
            .eq('id', lineId)
            .maybeSingle()

          if (lineRow) {
            const rawType = (lineRow.machine_type || lineRow.name || '').trim()
            const slug = rawType.toLowerCase()

            const KNOWN_CONFIG_KEYS: Record<string, string> = {
              blanking: 'blanking',
              pc200t: 'pc200t',
              tandem: 'tandem',
              'transfer-2000t': 'transfer_2000t',
              'transfer-800t': 'transfer_800t',
              transfer_2000t: 'transfer_2000t',
              transfer_800t: 'transfer_800t',
            }

            if (KNOWN_CONFIG_KEYS[slug]) {
              mesin = KNOWN_CONFIG_KEYS[slug]
            } else {
              const dashed = slug.replace(/_/g, '-')
              if (KNOWN_CONFIG_KEYS[dashed]) {
                mesin = KNOWN_CONFIG_KEYS[dashed]
              } else {
                mesin = slug.replace(/-/g, '_')
              }
            }
          }
        }

        const { error: insertPartErr } = await supabase
          .from('prod_part_numbers' as any)
          .insert({
            line_id: lineId || null,
            mesin: mesin || null,
            value: newPartNumberValue.trim(),
            document_id: uploadedDoc.id,
            is_active: true,
          })

        if (insertPartErr) {
          console.error('Gagal membuat part number baru untuk dokumen:', insertPartErr)
        }
      }
    }


    return NextResponse.json(
      {
        success: true,
        document: docData[0],
        message: 'Document uploaded successfully'
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Upload handler error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
