#!/usr/bin/env bash
# Exporta el proyecto completo; solo se excluyen archivos que pueden contener API keys/secretos (.env).
# Se incluyen: código, node_modules, .next, prisma, docs, deploy, etc.
# Uso: desde domus-plus → bash domus-beta-dbe/scripts/export-clean.sh
#      desde domus-beta-dbe → bash scripts/export-clean.sh
# Crea: domus-beta-dbe-clean-YYYYMMDD.tar.gz

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
NAME="domus-beta-dbe"
OUTPUT_DIR="${1:-.}"
STAMP="$(date +%Y%m%d)"
ARCHIVE="$OUTPUT_DIR/${NAME}-clean-${STAMP}.tar.gz"

# Solo excluir archivos que puedan tener secretos (API keys, JWT, etc.)
EXCLUDES=(
  --exclude ".env"
  --exclude ".env.local"
  --exclude ".env.production"
  --exclude ".env.development"
  --exclude ".env.test"
)
# .env.example SÍ se incluye (plantilla sin secretos)

echo "Exportando: $PROJECT_DIR -> $ARCHIVE"
echo "(solo se excluyen .env* con secretos; se incluyen node_modules, .next, todo lo demás)"
tar "${EXCLUDES[@]}" -czf "$ARCHIVE" -C "$(dirname "$PROJECT_DIR")" "$(basename "$PROJECT_DIR")"
echo "Listo: $ARCHIVE"
echo ""
echo "En el otro proyecto:"
echo "  tar xzf $(basename "$ARCHIVE")"
echo "  cd $NAME"
echo "  cp .env.example .env   # y edita .env con tu DATABASE_URL y JWT_SECRET"
echo "  npm run dev"
