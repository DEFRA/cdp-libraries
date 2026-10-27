#!/usr/bin/env bash
# Refreshes the tool's copy of the CDP log pipeline from cdp-opensearch-core and
# cdp-fluentbit clones (pulled). Safe to re-run: files only change when their
# source did, and git shows what changed.
#
#   CDP_ROOT_PATH  folder holding the repos (default: the one holding cdp-libraries)
set -euo pipefail

cd "$(dirname "$0")"
CDP_ROOT_PATH=$(realpath "${CDP_ROOT_PATH:-../../..}")
OPENSEARCH_CORE=$CDP_ROOT_PATH/cdp-opensearch-core
FLUENTBIT=$CDP_ROOT_PATH/cdp-fluentbit
for repo in $OPENSEARCH_CORE $FLUENTBIT; do
  [ -d "$repo" ] || { echo "$repo not found, set CDP_ROOT_PATH to the folder holding it" >&2; exit 2; }
done
CONFIG=src/config
FLUENTBIT_HASH=test/fluent-bit/parse-json-filters.sha256

# default-logs-pipeline processors ($$ is Terraform's escaped $)
sed 's/\[\${include_keys}\]/[]/' $OPENSEARCH_CORE/modules/opensearch_ingestion/files/tenants/yaml/cdp-logs-pipeline.yaml \
  | npx --yes js-yaml@4.3.2 | sed 's/\$\$/$/g' | jq '."default-logs-pipeline".processor' > $CONFIG/cdp-logs-pipeline.json

# include_keys
sed -n '/variable "include_keys"/,/^}/p' $OPENSEARCH_CORE/modules/opensearch_ingestion/vars.tf \
  | grep -o '"[^"]*"' | grep -v include_keys | jq -s . > $CONFIG/include-keys.json

# index mapping
jq '.template.mappings' $OPENSEARCH_CORE/templates/cdp-logs-mappings.json.tmpl > $CONFIG/cdp-logs-mappings.json

# Fluent Bit version and filters are ported by hand to src/fluent-bit.js, so only
# their hash is kept: it changes when they do
{
  grep '^ARG FLB_VERSION=' $FLUENTBIT/Dockerfile
  awk '/^\[OUTPUT\]/ { exit } /^\[FILTER\]/ { on = 1 } on' $FLUENTBIT/parse-json.conf
} | sha256sum | cut -d' ' -f1 > $FLUENTBIT_HASH

# The tool fails on start if the pipeline uses a step it doesn't handle
echo '{}' | node bin/cdp-log-pipeline.js > /dev/null

# Compare each file with the last commit
status=up-to-date
for file in $CONFIG/*.json $FLUENTBIT_HASH; do
  if ! git cat-file -e "HEAD:./$file" 2>/dev/null; then
    echo "NEW      $file: not committed yet, commit it so later runs can compare"
    status=new
  elif ! git diff --quiet HEAD -- "$file"; then
    status=changed
    if [ "$file" = "$FLUENTBIT_HASH" ]; then
      echo "CHANGED  Fluent Bit filters or version: see git -C $FLUENTBIT log -p -- parse-json.conf Dockerfile"
      echo "         then update src/fluent-bit.js and run npm run test:fluent-bit"
    else
      echo "CHANGED  $file: its source changed upstream, review with: git diff $file"
    fi
  fi
done
[ "$status" != up-to-date ] || echo "Up to date: no changes in cdp-opensearch-core or cdp-fluentbit"
