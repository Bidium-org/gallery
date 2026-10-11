#!/bin/sh
# gallery <command> ['<json>' | -]    run a command on the open canvas ('-' reads the JSON from stdin)
# gallery help [command]              list the commands, or describe one
#
# Prints the host's JSON answer. Exit: 0 ok, 1 fix the call, 2 app not ready, 3 timeout.

HOST_FILE="$HOME/.gallery/host.json"

# die <code> <message> <exit status>: same shape as the host's errors. Plain printf, so it works
# without jq. Messages carry no quote or backslash.
die() {
  printf '{"ok":false,"error":"%s","message":"%s"}\n' "$1" "$2"
  exit "$3"
}

[ $# -ge 1 ] || die usage "Usage: gallery <command> ['<json>' | -] or gallery help [command]." 1
command -v jq >/dev/null 2>&1 || die jq_missing "jq was not found in PATH." 2

name=$1
if [ $# -lt 2 ]; then
  args='{}'
elif [ "$2" = - ]; then
  args=$(cat)
else
  args=$2
fi

if [ "$name" != help ]; then
  printf '%s' "$args" | jq -s -e 'length == 1' >/dev/null 2>&1 ||
    die invalid_json "The arguments are not one valid JSON value." 1
fi

url=$(jq -r '.url // empty' "$HOST_FILE" 2>/dev/null)
[ -n "$url" ] || die host_not_running "Gallery is not running: open the app, then retry." 2

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
trap 'exit 1' HUP INT TERM

if [ "$name" = help ]; then
  endpoint=commands
  [ $# -ge 2 ] && endpoint="commands/$(jq -rn --arg n "$2" '$n | @uri')"
  set -- -X GET "$url/api/agent/$endpoint"
else
  printf '%s' "$args" | jq -c --arg name "$name" '{name: $name, args: .}' >"$work/request"
  set -- -X POST -H 'Content-Type: application/json' --data-binary "@$work/request" "$url/api/agent/command"
fi

# -g: curl would read the brackets of an IPv6 URL as a range. No timeout: the host enforces each one.
status=$(curl -s -g -o "$work/answer" -w '%{http_code}' "$@") ||
  die host_not_running "Gallery did not answer: open the app, then retry." 2

if jq -e 'type == "object"' "$work/answer" >/dev/null 2>&1; then
  cat "$work/answer"
  echo
else
  printf '{"ok":false,"error":"unexpected_response","message":"HTTP %s without a JSON object."}\n' "$status"
fi

case $status in
  504) exit 3 ;;
  2??) exit 0 ;;
  409 | 5??) exit 2 ;;
  *) exit 1 ;;
esac
