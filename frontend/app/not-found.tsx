export default function NotFound() {
  return (
    <div className="min-h-screen bg-sap-bg flex items-center justify-center p-6">
      <div className="text-center sap-page-container max-w-md">
        <h1 className="text-display font-semibold text-sap-text mb-2 tracking-tight">404</h1>
        <p className="text-body text-sap-text-secondary mb-6">Esta página no se pudo encontrar.</p>
        <a href="/" className="sap-button-primary rounded-domus-lg">
          Volver al inicio
        </a>
      </div>
    </div>
  )
}
