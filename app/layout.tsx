import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import { IosTouchListener } from '@/components/ui/ios-touch-listener'
import { AutoHideScrollbar } from '@/components/ui/auto-hide-scrollbar'
import { PwaRegister } from '@/components/pwa-register'
import { GlobalAndonAlert } from '@/components/produksi/GlobalAndonAlert'
import './globals.css'


export const metadata: Metadata = {
  title: 'PKIS',
  description: 'Sistem manajemen dokumen terpusat untuk PT Futaba',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'PKIS',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#00A545' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        {/* Prevent flash of wrong theme by applying class before React hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('futaba.theme');if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.classList.remove('light');}else if(t==='light'){document.documentElement.classList.add('light');document.documentElement.classList.remove('dark');}else{if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark');document.documentElement.classList.remove('light');}else{document.documentElement.classList.add('light');document.documentElement.classList.remove('dark');}}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <IosTouchListener />
        <AutoHideScrollbar />
        <PwaRegister />
        <GlobalAndonAlert />
        {children}
        <Toaster richColors position="bottom-right" closeButton />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
