import { deletePath, getPath, hasPath, isMap, setPath } from './paths.js'
import { readConfig } from './read-config.js'

// OpenSearch Ingestion: runs default-logs-pipeline from the config
// One handler per processor type in cdp-logs-pipeline.yaml, following the
// Data Prepper docs. Unknown processors or expressions throw on load, so a
// config refresh that needs more fails loudly.

const pipelineProcessors = readConfig('cdp-logs-pipeline.json')

// Only the expressions the pipeline uses: `<path> typeof string|map`,
// `<path> == null`, `<path> != null`, joined by `and`.
function compileCondition(expression) {
  const clauses = expression.split(' and ').map((clause) => {
    const [, path, op, operand] =
      /^(\/\S+) (typeof|==|!=) (string|map|null)$/.exec(clause.trim()) ?? []
    if (op === 'typeof' && operand === 'string') {
      return (event) => typeof getPath(event, path) === 'string'
    }
    if (op === 'typeof' && operand === 'map') {
      return (event) => isMap(getPath(event, path))
    }
    if (op && operand === 'null') {
      const isNull = (event) => (getPath(event, path) ?? null) === null
      return op === '==' ? isNull : (event) => !isNull(event)
    }
    throw new Error(`Unsupported Data Prepper expression: ${expression}`)
  })
  return (event) => clauses.every((clause) => clause(event))
}

// Production patterns are Java regex; JS has no leading `(?i)`, so it becomes
// the `i` flag. Other Java-only syntax fails in `new RegExp` on load.
export function toJsRegExp(pattern) {
  return pattern.startsWith('(?i)')
    ? new RegExp(pattern.slice(4), 'gi')
    : new RegExp(pattern, 'g')
}

const processorHandlers = {
  rename_keys:
    ({ entries }) =>
    (event, report) => {
      for (const { from_key: from, to_key: to, ...entry } of entries) {
        if (!hasPath(event, from)) continue
        if (hasPath(event, to) && !entry.overwrite_if_to_key_exists) continue
        const value = getPath(event, from)
        deletePath(event, from)
        setPath(event, to, value)
        report.renamed.push(`${from.replace(/^\//, '')} → ${to}`)
      }
    },

  add_entries: ({ entries }) => {
    const compiled = entries.map((entry) => {
      if (entry.value_expression && !/^\/\S+$/.test(entry.value_expression)) {
        throw new Error(
          `Unsupported value_expression: ${entry.value_expression}`
        )
      }
      return {
        ...entry,
        when: entry.add_when ? compileCondition(entry.add_when) : () => true,
        valueOf: (event) =>
          'value' in entry
            ? entry.value
            : entry.format
              ? entry.format.replace(/\$\{([^}]+)\}/g, (_, key) =>
                  String(getPath(event, key))
                )
              : getPath(event, entry.value_expression)
      }
    })
    return (event) => {
      for (const entry of compiled) {
        if (!entry.when(event)) continue
        if (hasPath(event, entry.key) && !entry.overwrite_if_key_exists) {
          continue
        }
        setPath(event, entry.key, entry.valueOf(event))
      }
    }
  },

  // `from` is a regex, every match is replaced
  substitute_string: ({ entries }) => {
    const compiled = entries.map(({ source, from, to }) => ({
      source,
      regex: new RegExp(from, 'g'),
      to
    }))
    return (event) => {
      for (const { source, regex, to } of compiled) {
        const value = getPath(event, source)
        if (typeof value === 'string') {
          setPath(event, source, value.replace(regex, to))
        }
      }
    }
  },

  // Each whole match (or the whole value, with no patterns) becomes
  // mask_character × mask_character_length, default `***`. Strings only.
  obfuscate: ({ source, target = source, patterns = [], action }) => {
    const mask = (action?.mask?.mask_character ?? '*').repeat(
      action?.mask?.mask_character_length ?? 3
    )
    const regexes = patterns.map(toJsRegExp)
    return (event, report) => {
      const value = getPath(event, source)
      if (typeof value !== 'string') return
      const masked = regexes.length
        ? regexes.reduce((text, regex) => text.replace(regex, mask), value)
        : mask
      setPath(event, target, masked)
      if (masked !== value) report.redacted.push(target)
    }
  },

  date: ({ destination, date_when: dateWhen }, now) => {
    const when = dateWhen ? compileCondition(dateWhen) : () => true
    return (event) => {
      if (when(event)) setPath(event, destination, now().toISOString())
    }
  }
}

export function createIngestion(now) {
  const steps = pipelineProcessors.map((processor) => {
    const [type, options] = Object.entries(processor)[0]
    if (!processorHandlers[type]) {
      throw new Error(`Unsupported Data Prepper processor: ${type}`)
    }
    return processorHandlers[type](options, now)
  })
  return (event, report) => steps.forEach((step) => step(event, report))
}
