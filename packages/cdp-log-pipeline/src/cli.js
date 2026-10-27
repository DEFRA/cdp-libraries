import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { parseArgs } from 'node:util'

import { fluentBit } from './fluent-bit.js'
import { createPipeline } from './log-pipeline.js'

// CLI
// stdout only carries the stored documents (pipe it to jq), notes go to stderr.

export function formatResult(result, explain = false) {
  const notes =
    {
      rejected: () => [
        `rejected by OpenSearch, the whole line goes to cdp-broken-logs: ${result.errors.join('; ')}`
      ],
      audit: () => ['audit log: sent to the audit stream, not OpenSearch'],
      'api-gateway': () => [
        'API gateway access log: routed to the API gateway pipeline (cdp-api-gw-*), not simulated'
      ],
      'health-check': () =>
        explain ? ['dropped by Fluent Bit: successful /health request log'] : []
    }[result.outcome]?.() ?? []
  notes.push(...(result.warnings ?? []).map((warning) => `warning: ${warning}`))

  const {
    added = [],
    renamed = [],
    redacted = [],
    dropped = []
  } = result.report ?? {}
  if (explain) {
    if (added.length) notes.push(`added by Fluent Bit: ${added.join(', ')}`)
    if (renamed.length) notes.push(`renamed: ${renamed.join(', ')}`)
    if (redacted.length) notes.push(`redacted: ${redacted.join(', ')}`)
    if (dropped.length) {
      notes.push(`not allowed, dropped: ${dropped.join(', ')}`)
    }
    if (dropped.some((path) => path.startsWith('temp_log/'))) {
      notes.push(
        'hint: a nested `log` object is renamed to temp_log and only log/logger and log/file/path are kept. Use the flat "log.level" key.'
      )
    }
  }

  return {
    stdout:
      result.outcome === 'indexed' ? `${JSON.stringify(result.doc)}\n` : '',
    stderr: notes.map((note) => `[cdp-log-pipeline] ${note}\n`).join('')
  }
}

const usage = `Usage: npm run dev | npx @defra/cdp-log-pipeline [options]

Prints what CDP would store in OpenSearch for each log line read from stdin.

Options:
  -e, --explain                show renamed, redacted and dropped fields
      --fluent-bit-only        stop after the Fluent Bit stage and print each record
                               with its route (app or audit), to compare with real
                               Fluent Bit
      --service-name <name>    default: $SERVICE_NAME, then package.json name
      --service-version <ver>  default: $SERVICE_VERSION, then package.json version
  -h, --help                   show this help
`

// Same shape as real Fluent Bit's json_lines output, plus the route (tag)
function fluentBitOnly(
  line,
  { serviceName = 'unknown', serviceVersion = 'unknown' }
) {
  const { route, record } = fluentBit(line, { serviceName, serviceVersion })
  return {
    stdout:
      route === 'health-check'
        ? ''
        : `${JSON.stringify({ _route: route, ...record })}\n`,
    stderr: ''
  }
}

function readPackageJson(cwd) {
  try {
    return JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'))
  } catch {
    return {}
  }
}

export async function run({
  argv = process.argv.slice(2),
  env = process.env,
  cwd = process.cwd(),
  stdin = process.stdin,
  stdout = process.stdout,
  stderr = process.stderr
} = {}) {
  const { values } = parseArgs({
    args: argv,
    options: {
      explain: { type: 'boolean', short: 'e' },
      'fluent-bit-only': { type: 'boolean' },
      'service-name': { type: 'string' },
      'service-version': { type: 'string' },
      help: { type: 'boolean', short: 'h' }
    }
  })

  if (values.help) {
    stdout.write(usage)
    return
  }

  const pkg = readPackageJson(cwd)
  const service = {
    serviceName: values['service-name'] ?? env.SERVICE_NAME ?? pkg.name,
    serviceVersion:
      values['service-version'] ?? env.SERVICE_VERSION ?? pkg.version
  }
  // line → { stdout, stderr }
  let processLine
  if (values['fluent-bit-only']) {
    processLine = (line) => fluentBitOnly(line, service)
  } else {
    const pipeline = createPipeline(service)
    processLine = (line) => formatResult(pipeline(line), values.explain)
  }

  const lines = createInterface({ input: stdin, terminal: false })
  lines.on('line', (line) => {
    if (line.trim() === '') return
    // One bad line must not end the stream of the app's logs
    try {
      const output = processLine(line)
      stdout.write(output.stdout)
      stderr.write(output.stderr)
    } catch (error) {
      stderr.write(
        `[cdp-log-pipeline] could not process line: ${error.message}\n`
      )
    }
  })
  await new Promise((resolve) => lines.once('close', resolve))
}
