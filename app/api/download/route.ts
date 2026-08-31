import { createClient } from '@/lib/supabase/server'
import { getCurrentUserProfile } from '@/lib/services/auth-server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { filePath } = body

    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const userProfile = await getCurrentUserProfile()
    if (!userProfile.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Generate signed URL valid for 1 hour
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 3600)

    if (error) {
      console.error('Signed URL error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      url: data.signedUrl
    })
  } catch (error) {
    console.error('Download handler error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
