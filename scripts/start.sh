#!/bin/sh
set -eu
GROWTH_PROJECT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
. "$GROWTH_PROJECT/scripts/runtime.sh"
cd "$GROWTH_PROJECT"
export PORT="${PORT:-3001}"
exec "$GROWTH_NODE" --env-file-if-exists=.env server/api.js
