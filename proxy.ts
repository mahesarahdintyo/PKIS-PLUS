import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // Inisialisasi response awal
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Inisialisasi Supabase client dengan pola terbaru (getAll & setAll)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 1. Dapatkan sesi user saat ini
  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // 2. Proteksi Rute (Jika belum login, lempar ke halaman utama)
  if (!user && (path.startsWith('/admin') || path.startsWith('/operator'))) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // 3. Pengecekan Role (RBAC) jika user sudah login
  if (user) {
    // Ambil role dari tabel profiles atau user metadata
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const rawRole = (profile?.role || user.user_metadata?.role || user.app_metadata?.role || '') as string
    const cleanRole = typeof rawRole === 'string' ? rawRole.trim().toLowerCase() : ''
    const isAdmin = cleanRole === 'admin'

    // Jika mencoba akses /admin tapi bukan admin
    if (path.startsWith('/admin') && !isAdmin) {
      return NextResponse.redirect(new URL('/operator', request.url))
    }
  }

  return supabaseResponse
}

// Tentukan rute mana saja yang akan dicegat oleh middleware
export const config = {
  matcher: [
    '/admin/:path*',
    '/operator/:path*',
  ],
}