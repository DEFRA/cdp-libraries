import { fluentBit } from './fluent-bit.js'
import { createIngestion } from './ingestion.js'
import { checkTypes, selectEntries } from './opensearch.js'
import { getPath } from './paths.js'

// Simulates what CDP stores in OpenSearch (cdp-logs) for each log line, in
// production order: Fluent Bit sidecar → OpenSearch Ingestion → OpenSearch.
// One file per stage: fluent-bit.js, ingestion.js, opensearch.js.
//
// outcome: indexed (doc is what cdp-logs stores), rejected (a type conflict,
// so OpenSearch rejects the whole line and it ends up in cdp-broken-logs),
// audit, health-check (dropped by Fluent Bit), or api-gateway (routed to the
// API gateway pipeline, not simulated).

const isApiGatewayLog = (record) =>
  [getPath(record, 'api_gw_name'), getPath(record, 'message/api_gw_name')].some(
    (value) => (value ?? null) !== null
  )

export function createPipeline({
  serviceName = 'unknown',
  serviceVersion = 'unknown',
  now = () => new Date()
} = {}) {
  const ingest = createIngestion(now)

  return function processLine(line) {
    const { route, record, addedStatusCode } = fluentBit(line, {
      serviceName,
      serviceVersion
    })
    if (route !== 'app') return { outcome: route, record }

    // entry-pipeline route in cdp-logs-pipeline.yaml
    if (isApiGatewayLog(record)) return { outcome: 'api-gateway', record }

    const warnings = []
    const level = record['log.level']
    // Fluent Bit's audit rule is case-sensitive (^audit$), so "AUDIT" is
    // indexed as a normal log. Easy to miss, so warn without changing it.
    if (typeof level === 'string' && level.toLowerCase() === 'audit') {
      warnings.push(
        `log.level "${level}" is not "audit" (case-sensitive), so CDP treats this as a normal log, not an audit event`
      )
    }

    const report = {
      added: [
        `service.name=${serviceName}`,
        `service.version=${serviceVersion}`
      ],
      renamed: [],
      redacted: [],
      dropped: []
    }
    ingest(record, report)
    const { doc, dropped } = selectEntries(record)
    // A status_code_str Fluent Bit added is its own helper field, not
    // something the app logged, so it would only confuse the report
    report.dropped = addedStatusCode
      ? dropped.filter((path) => path !== 'status_code_str')
      : dropped

    const errors = checkTypes(doc)
    return errors.length
      ? { outcome: 'rejected', doc, errors, report, warnings }
      : { outcome: 'indexed', doc, report, warnings }
  }
}
