import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('filePath')

    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data, error } = await supabase.storage
      .from('documents')
      .download(filePath)

    if (error) {
      console.error('Print file error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    const fileName = filePath.split('/').pop()?.replace(/"/g, '') || 'document'

    return new NextResponse(data, {
      headers: {
        'Cache-Control': 'private, max-age=300',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Content-Type': data.type || 'application/octet-stream'
      }
    })
  } catch (error) {
    console.error('Print file handler error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
