import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/contexts/auth-context'
import { Toaster } from '@/components/ui/toaster'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { PWALifecycle } from '@/components/pwa/pwa-lifecycle'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'PureCare - Air Purification System',
  description: 'Monitor and control your IoT air purifiers in real-time',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/icons/icon.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: ['/icons/favicon.ico'],
    apple: [{ url: '/icons/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PureCare',
  },
  generator: 'CSE4006 G07',
}

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <AuthProvider>
          {children}
          <InstallPrompt />
          <Toaster />
        </AuthProvider>
        <PWALifecycle />
        <Analytics />
      </body>
    </html>
  )
}
