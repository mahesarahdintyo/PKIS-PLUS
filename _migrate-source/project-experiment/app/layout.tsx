import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dashboard Stamping Production",
  description: "Sistem Input & Monitoring Produksi & Downtime Mesin Stamping",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#1a1e24",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`dark ${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme_v1')||'dark';if(t==='dark'){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}document.documentElement.setAttribute('data-theme',t);})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <ServiceWorkerRegister />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
