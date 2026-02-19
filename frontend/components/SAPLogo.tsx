'use client'

import Link from 'next/link'

interface SAPLogoProps {
  size?: number
  showText?: boolean
  className?: string
  href?: string
}

export default function SAPLogo({ 
  size = 32, 
  showText = true, 
  className = '',
  href
}: SAPLogoProps) {
  const logoContent = (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Logo corporativo estilo SAP - Simple y profesional */}
      <div 
        className="flex items-center justify-center bg-sap-primary text-white font-bold rounded-domus"
        style={{ width: size, height: size, fontSize: size * 0.5 }}
      >
        D+
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className="text-white font-semibold text-sm leading-tight">Domus Fam</span>
          <span className="text-white/70 text-[10px] leading-tight">Gestión Financiera</span>
        </div>
      )}
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block">
        {logoContent}
      </Link>
    )
  }
  
  return logoContent
}
