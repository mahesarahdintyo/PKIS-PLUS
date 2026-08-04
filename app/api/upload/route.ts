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
    const reqLandId = formData.get('landId') as string
    const targetTime = formData.get('targetTime') as string | null

    const userProfile = await getCurrentUserProfile()
    const landId = userProfile.role === 'operator' && userProfile.landId ? userProfile.landId : reqLandId

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
    const fileName = `${Date.now()}-${file.name}`
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
      land_id: landId || null,
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
