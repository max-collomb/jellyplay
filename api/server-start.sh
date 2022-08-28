#!/bin/sh
cd /volume1/server/jellyplay/api
cp db/_volume1_share_media_movies db/backups/_volume1_share_media_movies.$(date +%Y-%m-%d_%Hh%Mm%Ss)
find ./db/backups -name "_volume1_share_media_movies.*" -type f -mtime +30 -delete
PM2_HOME='/var/services/homes/administrator/.pm2' ./node_modules/pm2/bin/pm2 start dist/index.js --node-args="--experimental-specifier-resolution=node" --time
