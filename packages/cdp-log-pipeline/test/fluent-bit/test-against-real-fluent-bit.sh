#!/usr/bin/env bash
# Runs every case in cases.txt through real Fluent Bit (the version and filters
# from a cdp-fluentbit clone) and through the tool's Fluent Bit stage, and
# fails if any output differs. Not part of `npm test`: needs Docker.
#
#   npm run test:fluent-bit            # summary, details for differences
#   VERBOSE=1 npm run test:fluent-bit  # input and both outputs for every case
#
# cdp-fluentbit is expected next to cdp-libraries, or set CDP_ROOT_PATH to the
# folder holding it.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
package=$(cd "$here/../.." && pwd)
fluentbit_dir=${CDP_ROOT_PATH:-$package/../../..}/cdp-fluentbit

for command in docker jq node; do
  command -v "$command" >/dev/null || { echo "missing: $command" >&2; exit 2; }
done
if [ ! -f "$fluentbit_dir/parse-json.conf" ]; then
  echo "cdp-fluentbit not found at $fluentbit_dir, set CDP_ROOT_PATH" >&2
  exit 2
fi

version=$(sed -n 's/^ARG FLB_VERSION="\(.*\)"/\1/p' "$fluentbit_dir/Dockerfile")
image="fluent/fluent-bit:${version:?FLB_VERSION not found in cdp-fluentbit Dockerfile}"
commit=$(git -C "$fluentbit_dir" rev-parse --short HEAD 2>/dev/null || echo unknown)

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cp "$here/fluent-bit.conf" "$work/"
# Only the [FILTER] sections: its [SERVICE] would load the parsers file a
# second time (Fluent Bit aborts), and its [OUTPUT] would call AWS Firehose
awk '/^\[OUTPUT\]/ { exit } /^\[FILTER\]/ { on = 1 } on' \
  "$fluentbit_dir/parse-json.conf" >"$work/parse-json-filters.conf"
grep -q '^\[FILTER\]' "$work/parse-json-filters.conf" ||
  { echo "no [FILTER] found in $fluentbit_dir/parse-json.conf" >&2; exit 2; }

echo "Fluent Bit $version, cdp-fluentbit@$commit"
docker pull -q "$image" >/dev/null

# Like Docker's log driver: a line over 16KB reaches Fluent Bit as 16KB pieces
# with partial_* labels, otherwise as {"log": line}
to_docker_records='
  (. as $line | [range(0; length; 16384) | $line[.:.+16384]]) as $pieces
  | if ($pieces | length) <= 1 then {log: .}
    else $pieces | to_entries[] | {
      log: .value, partial_message: "true", partial_id: "p\(input_line_number)",
      partial_ordinal: "\(.key + 1)",
      partial_last: (if .key == ($pieces | length) - 1 then "true" else "false" end)
    } end'
# Same shape as the tool's --fluent-bit-only output. Numbers are compared by
# value: JS prints 200.0 as 200.
with_route='
  if has("route_audit") then {_route: "audit"} else {_route: "app"} end
  + del(.route_app, .route_audit)
  | walk(if type == "number" then . + 0 else . end)'

real_fluent_bit() {
  jq -c -R "$to_docker_records" |
    docker run --rm -i -v "$work":/cfg:ro \
      -e SERVICE_NAME=my-svc -e SERVICE_VERSION=1.0.0 \
      "$image" -c /cfg/fluent-bit.conf 2>/dev/null |
    { grep '^{' || true; } |
    jq -cS "$with_route"
}

tool() {
  node "$package/bin/cdp-log-pipeline.js" --fluent-bit-only \
    --service-name my-svc --service-version 1.0.0 | jq -cS .
}

# Each case gets its own container: real Fluent Bit's type_converter can
# depend on earlier records, so sharing one would make results order-dependent
cases=()
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    '' | '#'*) cases+=("$line") ;;
    '@long '*) cases+=("$(jq -cn --argjson n "${line#@long }" '{message: "long", stack: ("x" * $n)}')") ;;
    *) cases+=("$line") ;;
  esac
done <"$here/cases.txt"

mkdir "$work/out"
for i in "${!cases[@]}"; do
  case "${cases[$i]}" in '' | '#'*) continue ;; esac
  while [ "$(jobs -rp | wc -l)" -ge 8 ]; do wait -n || true; done
  # Outputs are compared, not exit codes (Fluent Bit exits non-zero when
  # stdin closes)
  (
    set +e +o pipefail
    printf '%s\n' "${cases[$i]}" | real_fluent_bit >"$work/out/$i.real"
    printf '%s\n' "${cases[$i]}" | tool >"$work/out/$i.tool"
    true
  ) &
done
wait

total=0
different=0
for i in "${!cases[@]}"; do
  input=${cases[$i]}
  case "$input" in
    '') continue ;;
    '#'*) [[ $input == '# Filter'* ]] && echo && echo "${input#\# }"; continue ;;
  esac

  real=$(<"$work/out/$i.real")
  ours=$(<"$work/out/$i.tool")
  total=$((total + 1))
  if [ -n "$real" ]; then result=$(jq -r ._route <<<"$real"); else result=dropped; fi
  shown=$input
  [ ${#shown} -gt 100 ] && shown="${shown:0:97}..."

  if [ "$real" = "$ours" ]; then
    printf '  SAME  %-7s  %s\n' "$result" "$shown"
  else
    different=$((different + 1))
    echo "  DIFF  $shown"
  fi
  if [ "$real" != "$ours" ] || [ -n "${VERBOSE:-}" ]; then
    echo "        Fluent Bit: ${real:-<dropped>}" | cut -c1-300
    echo "        tool:       ${ours:-<dropped>}" | cut -c1-300
  fi
done

echo
echo "$total cases, $different different"
[ "$different" -eq 0 ]
