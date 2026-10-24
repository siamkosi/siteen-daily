#!/bin/sh
set -eu
node /app/scripts/check-container-env.mjs
exec "$@"
