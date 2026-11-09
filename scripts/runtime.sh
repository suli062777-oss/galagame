#!/bin/sh
# Only use an installed Node or the verified bundled Codex runtime; no installation.
if command -v node >/dev/null 2>&1; then
  GROWTH_NODE="$(command -v node)"
elif [ -x /Users/lisuhang1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ]; then
  GROWTH_NODE=/Users/lisuhang1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
else
  echo 'Node.js 22+ is required. Install it from the official Node.js distribution.' >&2
  exit 1
fi
