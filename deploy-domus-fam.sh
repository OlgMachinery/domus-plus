#!/usr/bin/env bash
# Deploy de domus-beta-dbe a domus-fam.com (VPS).
# Ejecutar desde la raíz del repo: domus-plus
#
# Uso desde raíz (domus-plus):
#   ./deploy-domus-fam.sh --host 187.77.16.4 --chown deploy
#
# Si tienes DOMUS_VPS_HOST en el entorno:
#   export DOMUS_VPS_HOST=187.77.16.4
#   ./deploy-domus-fam.sh --chown deploy
#
# Si falla "Permission denied" con contraseña (o tras 3 intentos se cierra):
#   Usa clave SSH (recomendado). En la VPS ya debe estar tu clave pública en ~root/.ssh/authorized_keys.
#   Ejemplo con clave en ~/.ssh/id_rsa o ~/.ssh/id_ed25519:
#   SSH_OPTS="-i $HOME/.ssh/id_ed25519" ./deploy-domus-fam.sh --host 187.77.16.4 --chown deploy
#   (Sustituye id_ed25519 por el nombre de tu clave privada si es distinto.)

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT/domus-beta-dbe"
# Pasar SSH_OPTS si lo definiste (ej. SSH_OPTS="-i ~/.ssh/mi_clave")
export SSH_OPTS="${SSH_OPTS:-}"
exec ./deploy/deploy-vps.sh "$@"
