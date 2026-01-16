import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-md w-full">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">DOMUS+</h1>
        <p className="text-gray-600 mb-8">Sistema de Gestión Familiar</p>
        
        <div className="space-y-4 flex flex-col">
          <Link 
            href="/login"
            className="w-full bg-blue-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors text-center"
          >
            Iniciar Sesión
          </Link>
          
          <Link 
            href="/dashboard"
            className="w-full bg-white text-gray-700 font-medium py-3 px-4 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-center"
          >
            Ir al Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
