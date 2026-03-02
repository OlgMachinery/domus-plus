#!/usr/bin/env bash
set -euo pipefail

# Valores por defecto (se pueden sobreescribir por variables de entorno)
DB_FILE="${DB_FILE:-/var/lib/domus-beta-dbe/domus.db}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/domus-beta-dbe}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

TS="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/domus_${TS}.db"

if [ ! -f "$DB_FILE" ]; then
  echo "No existe DB_FILE: $DB_FILE"
  exit 1
fi

# Backup seguro (no corrompe aunque esté en uso)
sqlite3 "$DB_FILE" ".backup '$OUT'"

echo "Backup creado: $OUT"

# Limpieza: elimina backups viejos (por defecto 14 días)
python3 - <<'PY'
import glob
import os
import time

backup_dir = os.environ.get("BACKUP_DIR", "/var/backups/domus-beta-dbe")
retention_days = int(os.environ.get("RETENTION_DAYS", "14"))
cutoff = time.time() - (retention_days * 86400)

for path in glob.glob(os.path.join(backup_dir, "domus_*.db")):
  try:
    if os.path.getmtime(path) < cutoff:
      os.remove(path)
  except FileNotFoundError:
    pass
PY

