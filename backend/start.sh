#!/bin/bash
set -e

node dist/apps/ingestion/main.js &
node dist/apps/spc-engine/main.js &
node dist/apps/alerting/main.js &
node dist/apps/gateway/main.js &

# If any process dies, stop the container so Render restarts the whole service
wait -n
exit 1
