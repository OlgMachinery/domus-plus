import './globals.css'
import type { Metadata } from 'next'
import { ReactNode } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import Script from 'next/script'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Domus Fam',
  description: 'Sistema de Gestión Familiar',
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="es" className={plusJakarta.variable}>
      <body className="font-sans" suppressHydrationWarning>
        <Script id="domus-chunk-reload" strategy="beforeInteractive">
          {`(function(){try{var k='domus_chunk_reload_once';function should(msg){msg=String(msg||'');return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i.test(msg);}function already(){try{return !!sessionStorage.getItem(k);}catch(e){return false;}}function mark(){try{sessionStorage.setItem(k,String(Date.now()));}catch(e){}}function reload(msg){if(already())return;mark();console.warn('[domus] Reload due to chunk load error:',msg);window.location.reload();}window.addEventListener('error',function(e){if(should(e&&e.message))reload(e.message);});window.addEventListener('unhandledrejection',function(e){var r=e&&e.reason;var msg=(r&&r.message)?r.message:String(r||'');if(should(msg))reload(msg);});}catch(e){}})();`}
        </Script>
        {children}
      </body>
    </html>
  )
}
