"use client";

import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

interface AppHeaderProps {
  children?: ReactNode
  logoAside?: ReactNode
  disableLogoLink?: boolean
}

export function AppHeader({ children, logoAside, disableLogoLink = false }: AppHeaderProps) {
  const logo = (
    <Image
      src="/pkis-logo-wordmark(final).png"
      alt="PKIS Logo"
      width={150}
      height={50}
      className="object-contain h-10 sm:h-11 lg:h-12 w-auto"
      priority
    />
  )

  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            {disableLogoLink ? (
              <div className="inline-flex w-fit" aria-label="FUTABA Logo">
                {logo}
              </div>
            ) : (
              <Link
                href="/"
                aria-label="Kembali ke landing page"
                className="inline-flex w-fit"
              >
                {logo}
              </Link>
            )}
            {logoAside}
          </div>

          {children && (
            <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
              {children}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
