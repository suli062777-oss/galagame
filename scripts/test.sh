#!/bin/sh
set -eu
GROWTH_PROJECT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
. "$GROWTH_PROJECT/scripts/runtime.sh"
cd "$GROWTH_PROJECT"
exec "$GROWTH_NODE" --test tests/*.test.js
