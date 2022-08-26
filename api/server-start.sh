#!/bin/sh
cd /volume1/server/jellyplay/api
./node_modules/pm2/bin/pm2 start dist/index.js --node-args="--experimental-specifier-resolution=node" --time
