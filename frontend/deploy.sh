#!/usr/bin/env bash
# Deploy script para Hostinger (o cualquier VPS).
# Uso: desde este directorio (frontend): ./deploy.sh
# O desde la raíz del repo: ./frontend/deploy.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Directorio: $SCRIPT_DIR"

# Instalar TODAS las dependencias (incluidas dev: Tailwind/PostCSS necesarios para el build)
echo "==> Instalando dependencias (npm ci)..."
npm ci

echo "==> Build de producción..."
npm run build

echo "==> Deploy listo. Reinicia el proceso que sirve la app, por ejemplo:"
echo "    pm2 restart domus-plus   # o el nombre de tu proceso"
echo "    systemctl restart domus  # o tu servicio"
echo ""
echo "Para arrancar solo este servidor: npm run start"
