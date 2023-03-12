#!/bin/sh
cd /volume1/server/jellyplay/api
# PM2_HOME='/var/services/homes/administrator/.pm2' ./node_modules/pm2/bin/pm2 stop dist/index.js
npx kill-port 3000
