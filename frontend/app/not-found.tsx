export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">404</h1>
        <p className="text-muted-foreground mb-6">Esta página no se pudo encontrar.</p>
        <a href="/" className="sap-button-primary">
          Volver al inicio
        </a>
      </div>
    </div>
  )
}
