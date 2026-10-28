import { isMap } from './paths.js'

// Fluent Bit: hand port of cdp-fluentbit parse-json.conf
// One block per [FILTER], in the file's order. Not simulated: the container_*
// / ecs_* / source / date fields FireLens adds next to `log`.

// Fluent Bit keeps JSON's integer/float distinction, JS doesn't: 200.0 is a
// float to Fluent Bit. Remember which numbers were written as integers.
function parseJson(line) {
  const integers = new WeakMap()
  const value = JSON.parse(line, function (key, value, context) {
    if (typeof value === 'number' && /^-?\d+$/.test(context?.source)) {
      if (!integers.has(this)) integers.set(this, new Set())
      integers.get(this).add(key)
    }
    return value
  })
  const isInteger = (holder, key) => integers.get(holder)?.has(key) ?? false
  return { value, isInteger }
}

export function fluentBit(line, { serviceName, serviceVersion }) {
  // Filter 1: multiline
  // Filter 2: parser
  let record
  let isInteger = () => false
  try {
    ;({ value: record, isInteger } = parseJson(line))
  } catch {}
  if (!isMap(record)) record = { log: line }

  // Filter 3: type_converter
  // int_key only converts integers. The second line runs last, so http wins.
  const status = [
    [record.http, 'response.status_code'],
    [record.res, 'statusCode']
  ].find(([holder, key]) => isInteger(holder, key))
  if (status) record.status_code_str = String(status[0][status[1]])

  // Filters 4 and 5: grep, Logical_Op AND (each drops a line matching both).
  // Matches status_code_str whoever set it, the app included.
  const path = [record.req?.url, record.url?.path]
  if (
    typeof record.status_code_str === 'string' &&
    /^2\d\d$/.test(record.status_code_str) &&
    path.includes('/health')
  ) {
    return { route: 'health-check', record }
  }

  // Filter 6: record_modifier
  // Replaces any service.name / service.version the app logged.
  record['service.name'] = serviceName
  record['service.version'] = serviceVersion

  // Filter 7: rewrite_tag
  // Audit logs are re-tagged for the Firehose [OUTPUT] and never reach
  // OpenSearch. Case-sensitive: "AUDIT" stays on the normal route.
  if (record['log.level'] === 'audit') {
    return { route: 'audit', record }
  }
  return { route: 'app', record, addedStatusCode: Boolean(status) }
}
