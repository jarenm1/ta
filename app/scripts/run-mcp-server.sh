#!/run/current-system/sw/bin/bash
set -euo pipefail

DIRENV_BIN="/etc/profiles/per-user/jaren/bin/direnv"
BASH_BIN="/run/current-system/sw/bin/bash"

if [[ ! -x "${DIRENV_BIN}" ]]; then
  echo "Unable to locate direnv at ${DIRENV_BIN}." >&2
  exit 1
fi

NODE_PATH="$(${DIRENV_BIN} exec /home/jaren/ta ${BASH_BIN} -lc 'command -v node' 2>/dev/null)"
if [[ -z "${NODE_PATH}" ]]; then
  echo "Unable to resolve node from direnv/nix shell." >&2
  exit 1
fi
exec "$NODE_PATH" /home/jaren/ta/app/mcp-server/server.mjs
