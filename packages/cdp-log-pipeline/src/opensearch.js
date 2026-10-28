import { getPath, hasPath, isMap, leafPaths, setPath } from './paths.js'
import { readConfig } from './read-config.js'

// OpenSearch: select_entries, then the index mapping

const includeKeys = readConfig('include-keys.json')
const mappings = readConfig('cdp-logs-mappings.json')

export function selectEntries(event) {
  const doc = {}
  for (const key of includeKeys) {
    if (hasPath(event, key)) setPath(doc, key, getPath(event, key))
  }
  const dropped = leafPaths(event).filter(
    (path) =>
      !includeKeys.some((key) => path === key || path.startsWith(`${key}/`))
  )
  return { doc, dropped }
}

// What each field type accepts with OpenSearch's default `coerce`: numbers or
// decimal strings (no hex, Infinity), longs within 64 bits. Dates only check
// the default strict_date_optional_time || epoch_millis shape.
const decimal = /^\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?\s*$/
const toNumber = (value) =>
  typeof value === 'number' ||
  (typeof value === 'string' && decimal.test(value))
    ? Number(value)
    : NaN
const isFloat = (value) => Number.isFinite(toNumber(value))
const isLong = (value) => Math.abs(toNumber(value)) <= 2 ** 63
const isoDate =
  /^\d{4}(-\d{2}(-\d{2}(T\d{2}(:\d{2}(:\d{2}([.,]\d{1,9})?)?)?(Z|[+-]\d{2}(:?\d{2})?)?)?)?)?$/
const accepts = {
  text: (value) => typeof value !== 'object',
  keyword: (value) => typeof value !== 'object',
  long: isLong,
  float: isFloat,
  boolean: (value) => [true, false, 'true', 'false', ''].includes(value),
  date: (value) =>
    isFloat(value) || (typeof value === 'string' && isoDate.test(value))
}

const describe = (value) =>
  Array.isArray(value)
    ? 'an array'
    : isMap(value)
      ? 'an object'
      : `${typeof value} ${JSON.stringify(value)}`

function checkValue(value, mapping, field = '', errors = []) {
  if (value === null || value === undefined) return errors
  if (Array.isArray(value)) {
    value.forEach((item) => checkValue(item, mapping, field, errors))
    return errors
  }
  if (!mapping.properties) {
    if (isMap(value)) {
      errors.push(`${field}: expected ${mapping.type}, got an object`)
    } else if (accepts[mapping.type] && !accepts[mapping.type](value)) {
      errors.push(`${field}: expected ${mapping.type}, got ${describe(value)}`)
    }
    return errors
  }
  if (!isMap(value)) {
    errors.push(`${field}: expected an object, got ${describe(value)}`)
    return errors
  }
  for (const [key, child] of Object.entries(value)) {
    // OpenSearch reads {"trace.id": x} as trace → id. Fields missing from the
    // mapping are mapped dynamically, so they are not checked.
    let childMapping = mapping
    for (const segment of key.split('.')) {
      childMapping = childMapping?.properties?.[segment]
    }
    const childField = field ? `${field}.${key}` : key
    if (childMapping) checkValue(child, childMapping, childField, errors)
  }
  return errors
}

export const checkTypes = (doc) => checkValue(doc, mappings)
