#!/usr/bin/env bash
set -euo pipefail

# Despliegue a la VPS: rsync → npm ci → npm run build → restart.
# No guarda credenciales; usa tu llave/agent SSH.
#
# Uso:
#   ./deploy/deploy-vps.sh --host 187.77.16.4 --user root --path /srv/domus/app
#
# Flags extra:
#   --service NAME   (default: domus-beta)
#   --chown USER     después de rsync, chown -R USER:USER (recomendado para que login/DB no fallen)
#   --dry-run        (solo muestra qué subiría rsync)
#   SSH_OPTS="..."   (export, p.ej. -i clave -p 22)
#   DOMUS_DEPLOY_USER=deploy  (si no usas --chown, se usa este usuario para chown automático)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/deploy-vps.log"

HOST=""
USER="root"
REMOTE_PATH="/srv/domus/app"
SERVICE="domus-beta"
CHOWN_USER=""
DRY_RUN=0
SSH_OPTS="${SSH_OPTS:-}"

CHECK_URL_DEFAULT="https://domus-fam.com/api/build-info"

EXCLUDES=(
  --exclude .next
  --exclude node_modules
  --exclude ".env"
  --exclude ".env.local"
  --exclude prisma/dev.db
  --exclude start.log
)

log() {
  local msg="$1"
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[$ts] $msg" | tee -a "$LOG_FILE"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)     HOST="$2"; shift 2 ;;
    --user)     USER="$2"; shift 2 ;;
    --path)     REMOTE_PATH="$2"; shift 2 ;;
    --service)  SERVICE="$2"; shift 2 ;;
    --chown)    CHOWN_USER="$2"; shift 2 ;;
    --dry-run)  DRY_RUN=1; shift ;;
    *)
      echo "Opción desconocida: $1" >&2
      exit 1 ;;
  esac
done

# Si no se pasó --host, usar variable de entorno (p. ej. DOMUS_VPS_HOST=187.x.x.x)
if [[ -z "$HOST" && -n "${DOMUS_VPS_HOST:-}" ]]; then
  HOST="$DOMUS_VPS_HOST"
fi
if [[ -z "$HOST" ]]; then
  echo "Falta --host. Usa: --host IP_O_HOSTNAME o export DOMUS_VPS_HOST=IP" >&2
  exit 1
fi

# Tras rsync los archivos quedan como root; el servicio corre como deploy. Sin chown, login/DB fallan.
# Si no pasaste --chown, usar DOMUS_DEPLOY_USER (ej. export DOMUS_DEPLOY_USER=deploy)
if [[ -z "$CHOWN_USER" && -n "${DOMUS_DEPLOY_USER:-}" ]]; then
  CHOWN_USER="$DOMUS_DEPLOY_USER"
fi

RSYNC_EXTRA=()
if [[ "$DRY_RUN" -eq 1 ]]; then
  RSYNC_EXTRA+=(--dry-run)
  log "Modo dry-run: no se subirá nada, solo se muestra rsync."
fi

log "Sincronizando proyecto a ${USER}@${HOST}:${REMOTE_PATH}"
# rsync usa SSH; hay que pasarle las mismas opciones (p. ej. -i clave) vía -e
RSYNC_SSH="ssh ${SSH_OPTS}"
rsync -avz -e "$RSYNC_SSH" --delete ${RSYNC_EXTRA+"${RSYNC_EXTRA[@]}"} "${EXCLUDES[@]}" . "${USER}@${HOST}:${REMOTE_PATH}/" | tee -a "$LOG_FILE"

if [[ "$DRY_RUN" -eq 1 ]]; then
  log "Dry-run completado. No se ejecutan pasos remotos."
  exit 0
fi

if [[ -n "$CHOWN_USER" ]]; then
  log "Tras el build se ejecutará chown -R ${CHOWN_USER}:${CHOWN_USER} (evita fallos de login/DB)"
fi
log "Instalando deps, build, permisos, schema DB (prisma db push) y restart en remoto (servicio: ${SERVICE})"
ssh $SSH_OPTS "${USER}@${HOST}" bash -s <<EOF | tee -a "$LOG_FILE"
set -euo pipefail
cd "$REMOTE_PATH"
npm ci
npm run build
$([ -n "$CHOWN_USER" ] && echo "chown -R ${CHOWN_USER}:${CHOWN_USER} ." || true)
$([ -n "$CHOWN_USER" ] && echo "sudo -u ${CHOWN_USER} npx prisma db push --accept-data-loss" || true)
systemctl restart "$SERVICE"
EOF

log "Esperando 8 s a que el servicio levante tras el restart..."
sleep 8
log "Chequeando ${CHECK_URL_DEFAULT}"
CHECK_STATUS=""
CHECK_BODY=""
for attempt in 1 2 3; do
  CHECK_RESP=$(curl -s -w "\n%{http_code}" --max-time 15 "${CHECK_URL_DEFAULT}" || true)
  CHECK_STATUS=$(echo "$CHECK_RESP" | tail -n1)
  CHECK_BODY=$(echo "$CHECK_RESP" | sed '$d')
  log "Intento $attempt: HTTP ${CHECK_STATUS:-?}"
  if [[ "${CHECK_STATUS:-0}" -eq 200 ]]; then
    break
  fi
  [[ $attempt -lt 3 ]] && log "Reintentando en 5 s..." && sleep 5
done
BODY_SAFE=$(printf '%s' "${CHECK_BODY:-<sin respuesta>}" | head -c 80 | tr -d '"$\\')
log "Respuesta build-info: ${BODY_SAFE}"

if [[ "${CHECK_STATUS:-0}" -ne 200 ]]; then
  log "Aviso: build-info no devolvió 200 tras 3 intentos. Revisa conectividad o el servicio."
fi

log "Listo. Verifica también en incógnito: https://domus-fam.com/ui/system-architecture?signal=1"
