#!/bin/sh
PATH=$PATH:/volume1/server/jellyplay/api/node_modules/forever/bin

start() {
        forever start --workingDir /volume1/server/jellyplay/api --sourceDir /volume1/server/jellyplay/api -l /volume1/server/jellyplay/api/logs/log.txt -o /volume1/server/jellyplay/api/logs/output.txt .

}

stop() {
        killall -9 node
}

case "$1" in
  start)
    start
    ;;
  stop)
    stop
    ;;
  *)
    echo "Usage: $0 {start|stop}"
esac