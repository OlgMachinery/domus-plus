import React from 'react'
import Link from 'next/link'

interface LogoProps {
  size?: number
  showText?: boolean
  className?: string
  href?: string
  textSize?: 'sm' | 'md' | 'lg' | 'xl'
  layout?: 'vertical' | 'horizontal' // Layout del logo
}

export default function Logo({ 
  size = 40, 
  showText = true, 
  className = '',
  href,
  textSize = 'md',
  layout = 'vertical' // Por defecto vertical (icono arriba, texto abajo)
}: LogoProps) {
  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl'
  }
  
  // Calcular tamaño del icono vs texto
  const iconSize = showText ? size : size
  
  const logoContent = (
    <div className={`flex ${layout === 'horizontal' ? 'flex-row items-center' : 'flex-col items-center'} gap-2 ${className}`}>
      {/* SVG del logo - 5 figuras humanas en círculo con corazón central */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 120 120"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* Figura 1 - Top-left (Verde brillante) - Sentido contrario a las agujas del reloj */}
        <g transform="translate(60,60) rotate(-20)">
          <circle cx="-22" cy="-20" r="8" fill="#22c55e"/>
          <path
            d="M -22,-12 Q -30,-2 -32,10 L -32,16 Q -30,22 -22,16"
            fill="#22c55e"
          />
        </g>
        
        {/* Figura 2 - Top-right (Rojo brillante) */}
        <g transform="translate(60,60) rotate(20)">
          <circle cx="22" cy="-20" r="8" fill="#ef4444"/>
          <path
            d="M 22,-12 Q 30,-2 32,10 L 32,16 Q 30,22 22,16"
            fill="#ef4444"
          />
        </g>
        
        {/* Figura 3 - Bottom-right (Púrpura vibrante) */}
        <g transform="translate(60,60) rotate(100)">
          <circle cx="22" cy="20" r="8" fill="#9333ea"/>
          <path
            d="M 22,28 Q 30,38 32,50 L 32,56 Q 30,62 22,56"
            fill="#9333ea"
          />
        </g>
        
        {/* Figura 4 - Bottom-center (Azul brillante) */}
        <g transform="translate(60,60) rotate(180)">
          <circle cx="0" cy="22" r="8" fill="#2383e2"/>
          <path
            d="M 0,30 Q -8,40 -10,52 L -10,58 Q -8,64 0,58"
            fill="#2383e2"
          />
        </g>
        
        {/* Figura 5 - Bottom-left (Amarillo/Naranja dorado) */}
        <g transform="translate(60,60) rotate(260)">
          <circle cx="-22" cy="20" r="8" fill="#f97316"/>
          <path
            d="M -22,28 Q -30,38 -32,50 L -32,56 Q -30,62 -22,56"
            fill="#f97316"
          />
        </g>
        
        {/* Corazón central (Rojo con contorno y rayas verticales) */}
        <g transform="translate(60,60)">
          <path
            d="M 0,-4 C -5,-9 -10,-4 -10,1 C -10,9 -5,16 0,23 C 5,16 10,9 10,1 C 10,-4 5,-9 0,-4 Z"
            fill="#ef4444"
            stroke="#dc2626"
            strokeWidth="2"
          />
          {/* Rayas verticales en el corazón */}
          <line x1="-4" y1="-1" x2="-4" y2="18" stroke="#dc2626" strokeWidth="1.5" opacity="0.9"/>
          <line x1="0" y1="-1" x2="0" y2="18" stroke="#dc2626" strokeWidth="1.5" opacity="0.9"/>
          <line x1="4" y1="-1" x2="4" y2="18" stroke="#dc2626" strokeWidth="1.5" opacity="0.9"/>
        </g>
      </svg>
      
      {/* Texto DOMUS+ - Estilo tridimensional con contorno púrpura */}
      {showText && (
        <div className="flex items-center justify-center">
          {layout === 'vertical' ? (
            // Layout vertical: texto curvado hacia arriba
            <svg 
              width={textSize === 'sm' ? 100 : textSize === 'md' ? 120 : textSize === 'lg' ? 140 : 160} 
              height={textSize === 'sm' ? 28 : textSize === 'md' ? 32 : textSize === 'lg' ? 36 : 40}
              viewBox="0 0 150 40"
              className="block"
            >
              <defs>
                <linearGradient id="purpleGradientLogo" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#c084fc" />
                  <stop offset="100%" stopColor="#9333ea" />
                </linearGradient>
                <filter id="shadow3d">
                  <feDropShadow dx="1" dy="1" stdDeviation="1" floodColor="#6b21a8" floodOpacity="0.3"/>
                </filter>
              </defs>
              
              {/* Texto DOMUS curvado hacia arriba */}
              <path
                id="curvePath"
                d="M 10,30 Q 75,20 140,30"
                fill="none"
              />
              
              {/* Sombra para efecto 3D */}
              <text
                fontSize={textSize === 'sm' ? 20 : textSize === 'md' ? 24 : textSize === 'lg' ? 28 : 32}
                fontWeight="bold"
                fill="#6b21a8"
                opacity="0.4"
                filter="url(#shadow3d)"
              >
                <textPath href="#curvePath" startOffset="0%">
                  DOMUS
                </textPath>
              </text>
              
              {/* Texto principal con contorno púrpura */}
              <text
                fontSize={textSize === 'sm' ? 20 : textSize === 'md' ? 24 : textSize === 'lg' ? 28 : 32}
                fontWeight="bold"
                fill="url(#purpleGradientLogo)"
                stroke="#6b21a8"
                strokeWidth="0.8"
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              >
                <textPath href="#curvePath" startOffset="0%">
                  DOMUS
                </textPath>
              </text>
              
              {/* Signo + ligeramente arriba y a la derecha */}
              <text
                x="115"
                y={textSize === 'sm' ? 20 : textSize === 'md' ? 22 : textSize === 'lg' ? 24 : 26}
                fontSize={textSize === 'sm' ? 18 : textSize === 'md' ? 22 : textSize === 'lg' ? 26 : 30}
                fontWeight="bold"
                fill="url(#purpleGradientLogo)"
                stroke="#6b21a8"
                strokeWidth="0.8"
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              >
                +
              </text>
            </svg>
          ) : (
            // Layout horizontal: texto recto
            <span 
              className={`${textSizeClasses[textSize]} font-bold`}
              style={{
                background: 'linear-gradient(to bottom, #c084fc, #9333ea)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: '1px 1px 2px rgba(107, 33, 168, 0.2)',
                letterSpacing: '-0.02em',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}
            >
              DOMUS<span style={{ color: '#9333ea', position: 'relative', top: '-2px', marginLeft: '2px' }}>+</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
  
  if (href) {
    return (
      <Link href={href} className="hover:opacity-80 transition-opacity">
        {logoContent}
      </Link>
    )
  }
  
  return logoContent
}

// Variante solo del icono (sin texto) - Para favicon y lugares pequeños
export function LogoIcon({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Figura 1 - Top-left (Verde brillante) */}
      <g transform="translate(60,60) rotate(-20)">
        <circle cx="-22" cy="-20" r="8" fill="#22c55e"/>
        <path
          d="M -22,-12 Q -30,-2 -32,10 L -32,16 Q -30,22 -22,16"
          fill="#22c55e"
        />
      </g>
      
      {/* Figura 2 - Top-right (Rojo brillante) */}
      <g transform="translate(60,60) rotate(20)">
        <circle cx="22" cy="-20" r="8" fill="#ef4444"/>
        <path
          d="M 22,-12 Q 30,-2 32,10 L 32,16 Q 30,22 22,16"
          fill="#ef4444"
        />
      </g>
      
      {/* Figura 3 - Bottom-right (Púrpura vibrante) */}
      <g transform="translate(60,60) rotate(100)">
        <circle cx="22" cy="20" r="8" fill="#9333ea"/>
        <path
          d="M 22,28 Q 30,38 32,50 L 32,56 Q 30,62 22,56"
          fill="#9333ea"
        />
      </g>
      
      {/* Figura 4 - Bottom-center (Azul brillante) */}
      <g transform="translate(60,60) rotate(180)">
        <circle cx="0" cy="22" r="8" fill="#2383e2"/>
        <path
          d="M 0,30 Q -8,40 -10,52 L -10,58 Q -8,64 0,58"
          fill="#2383e2"
        />
      </g>
      
      {/* Figura 5 - Bottom-left (Amarillo/Naranja dorado) */}
      <g transform="translate(60,60) rotate(260)">
        <circle cx="-22" cy="20" r="8" fill="#f97316"/>
        <path
          d="M -22,28 Q -30,38 -32,50 L -32,56 Q -30,62 -22,56"
          fill="#f97316"
        />
      </g>
      
      {/* Corazón central (Rojo con contorno y rayas verticales) */}
      <g transform="translate(60,60)">
        <path
          d="M 0,-4 C -5,-9 -10,-4 -10,1 C -10,9 -5,16 0,23 C 5,16 10,9 10,1 C 10,-4 5,-9 0,-4 Z"
          fill="#ef4444"
          stroke="#dc2626"
          strokeWidth="2"
        />
        {/* Rayas verticales en el corazón */}
        <line x1="-4" y1="-1" x2="-4" y2="18" stroke="#dc2626" strokeWidth="1.5" opacity="0.9"/>
        <line x1="0" y1="-1" x2="0" y2="18" stroke="#dc2626" strokeWidth="1.5" opacity="0.9"/>
        <line x1="4" y1="-1" x2="4" y2="18" stroke="#dc2626" strokeWidth="1.5" opacity="0.9"/>
      </g>
    </svg>
  )
}
