'use client'

import { useRouter } from 'next/navigation'

export default function Register() {
  const router = useRouter()
  
  return (
    <div style={{ padding: '20px' }}>
      <h1>Registro Simplificado</h1>
      <p>Si ves esto, el sistema base funciona.</p>
      <button onClick={() => router.push('/login')}>Ir al Login</button>
    </div>
  )
}
