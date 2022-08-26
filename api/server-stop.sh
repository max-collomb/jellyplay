#!/bin/sh
cd /volume1/server/jellyplay/api
./node_modules/pm2/bin/pm2 stop dist/index.js
