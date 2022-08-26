#!/bin/sh
PATH=$PATH:/volume1/server/jellyplay/api/node_modules/forever/bin
forever start --workingDir /volume1/server/jellyplay/api --sourceDir /volume1/server/jellyplay/api -l /volume1/server/jellyplay/api/logs/log.txt -o /volume1/server/jellyplay/api/logs/output.txt .
