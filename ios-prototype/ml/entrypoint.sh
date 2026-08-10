#!/bin/sh
set -eu

if [ -n "${FIREBASE_SERVICE_ACCOUNT_JSON:-}" ]; then
  printf '%s' "$FIREBASE_SERVICE_ACCOUNT_JSON" > /tmp/sa.json
  export GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa.json
fi

exec uvicorn serve:app --host 0.0.0.0 --port "${PORT:-8080}"
