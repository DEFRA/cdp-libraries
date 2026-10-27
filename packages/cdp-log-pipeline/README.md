# cdp-log-pipeline

See what CDP will store in OpenSearch for your service's logs, without deploying.

CDP only keeps an allowed set of log fields, renames some of them and redacts others. If a field is missing in
OpenSearch, run your logs through this locally to find out why.

## Usage

```bash
npm run dev | npx @defra/cdp-log-pipeline
```

Each log line is printed as the document CDP would store in the `cdp-logs` index. stdout carries only those documents,
so you can pipe it to `jq`. Notes go to stderr:

- **rejected**: a field has the wrong type for the index mapping (e.g. an object in `message`). OpenSearch rejects the
  whole line and it ends up in `cdp-broken-logs`.
- **audit log**: `log.level` is `audit`, so it goes to the audit stream, not OpenSearch.

`--explain` shows which fields were renamed, redacted, or dropped because they are not allowed. If your service logs
with `pino-pretty` locally, set `LOG_FORMAT=ecs` so it logs the JSON CDP receives.

## What it simulates

The same steps, in the same order, as production:

1. **Fluent Bit sidecar** ([cdp-fluentbit](https://github.com/DEFRA/cdp-fluentbit) `parse-json.conf`): parses the JSON
   line, drops successful `/health` request logs, adds `service.name` / `service.version`, routes audit logs away.
2. **OpenSearch Ingestion** ([cdp-opensearch-core](https://github.com/DEFRA/cdp-opensearch-core)
   `cdp-logs-pipeline.yaml`): stores non-JSON lines as `message` with `log.level: error`, renames fields, normalises
   .NET log levels, redacts, adds `@timestamp` / `@ingestion_timestamp`.
3. **OpenSearch**: keeps only the allowed fields (`include_keys`), then checks each value against the index mapping.

Keys follow the pipeline's rules: `/` means nested and `.` is part of the key name. `"trace.id": "x"` and
`"trace": {"id": "x"}` are different fields, and only one of them may be allowed.

## Checking against real Fluent Bit

`npm run test:fluent-bit` runs every case in [`test/fluent-bit/cases.txt`](test/fluent-bit/cases.txt) through real
Fluent Bit and through the tool's Fluent Bit stage (`--fluent-bit-only`), and fails if any output differs:

```text
Filter 4: grep on req.url (/health + 2xx is dropped)
  SAME  dropped  {"req":{"url":"/health"},"res":{"statusCode":200}}
  SAME  app      {"req":{"url":"/health"},"res":{"statusCode":301}}
...
49 cases, 0 different
```

It uses the Fluent Bit version and the `[FILTER]` sections from a `cdp-fluentbit` clone next to `cdp-libraries` (or in
`CDP_ROOT_PATH`), read fresh on every run, so run it after `parse-json.conf` changes. It needs Docker and `jq`, so
it is not part of `npm test`. `VERBOSE=1` prints both outputs for every case. Add a case to `cases.txt` for every new
filter or edge case.

## Refreshing the config

The tool is a copy of the pipeline in `cdp-opensearch-core` (`src/config/*.json`) and `cdp-fluentbit`
(`src/fluent-bit.js`, ported by hand). With both repos cloned next to `cdp-libraries` (or in `CDP_ROOT_PATH`) and pulled, run:

```bash
./refresh-config.sh
```

It regenerates the copy and is safe to re-run: if nothing changed upstream it prints `Up to date`, otherwise it lists
the changed files for review. Fluent Bit filters can't be ported automatically: if they changed, update
`src/fluent-bit.js` and run `npm run test:fluent-bit`.
