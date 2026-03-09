#!/usr/bin/env bash
# Deploy para Hostinger: actualiza código, instala deps e hace build del frontend.
# Uso desde la raíz del repo: ./deploy-hostinger.sh
# En el servidor suele ser: cd /srv/domus/app && git pull && ./deploy-hostinger.sh
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# Si en el servidor la app desplegada es solo el frontend, el "app" es frontend
if [ -d "frontend" ]; then
  echo "==> Usando frontend/ como app..."
  cd frontend
fi

echo "==> Directorio de trabajo: $(pwd)"

# Instalar todas las dependencias (incl. Tailwind/PostCSS para el build)
echo "==> Instalando dependencias..."
npm ci

echo "==> Build de producción..."
npm run build

echo ""
echo "==> Deploy listo. Reinicia el servicio, por ejemplo:"
echo "    pm2 restart domus-plus"
echo "    systemctl restart domus"
echo ""
echo "Para arrancar solo: npm run start"
