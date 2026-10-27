import { PassThrough } from 'node:stream'
import { describe, expect, test } from 'vitest'

import { formatResult, run } from './cli.js'
import { toJsRegExp } from './ingestion.js'
import { createPipeline } from './log-pipeline.js'
import { readConfig } from './read-config.js'

const pipelineProcessors = readConfig('cdp-logs-pipeline.json')

const now = () => new Date('2026-10-27T12:00:00.000Z')
const processLine = createPipeline({
  serviceName: 'example-backend',
  serviceVersion: '1.2.3',
  now
})
const send = (log) =>
  processLine(typeof log === 'string' ? log : JSON.stringify(log))

// Real @elastic/ecs-pino-format output from cdp-node-backend-template's logger
const pinoBase = {
  'log.level': 'info',
  '@timestamp': '2026-10-27T11:59:59.123Z',
  'process.pid': 4242,
  'host.hostname': 'example-host',
  'ecs.version': '8.10.0',
  'service.name': 'example-backend',
  'service.version': '0.1.0',
  'event.dataset': 'example-backend',
  trace: { id: 'f3a1c2d4e5b6a7980123456789abcdef' }
}

const pinoRequest = {
  ...pinoBase,
  responseTime: 12,
  req: {
    id: '1730000000000:host:1234:abcd:10',
    method: 'get',
    url: '/example?password=hunter2',
    query: { password: 'hunter2' },
    headers: {
      host: 'localhost:3001',
      'user-agent': 'curl/8.9.1',
      accept: '*/*',
      'x-cdp-request-id': 'f3a1c2d4e5b6a7980123456789abcdef',
      cookie: 'session=abc'
    },
    remoteAddress: '127.0.0.1',
    remotePort: 51234
  },
  res: {
    statusCode: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  },
  message: '[response] get /example?password=hunter2 200 (12ms)'
}

// Hand-written in the Elastic.CommonSchema.Serilog shape the pipeline's .NET
// renames expect
const serilogRequest = {
  '@timestamp': '2026-10-27T11:59:59.1234567+00:00',
  'log.level': 'Information',
  message: 'Request finished HTTP/1.1 GET http://localhost:5000/example - 200',
  'ecs.version': '8.11.0',
  log: { logger: 'Microsoft.AspNetCore.Hosting.Diagnostics' },
  labels: { CorrelationId: 'abc-123', MessageTemplate: 'Request finished' },
  process: { pid: 1, name: 'dotnet', 'thread.id': 7, 'thread.name': 'worker' },
  http: {
    'request.method': 'GET',
    'response.status_code': 200,
    'response.mime_type': 'application/json'
  },
  url: { path: '/example' },
  service: { name: 'Example', version: '0.0.1', type: 'dotnet' }
}

describe('the ticket known problems', () => {
  test('keeps trace, span and transaction ids and the ECS version', () => {
    const { doc } = send({
      'log.level': 'info',
      message: 'hi',
      'trace.id': 'abc123',
      'span.id': 's1',
      'transaction.id': 't1',
      'ecs.version': '8.10.0'
    })

    expect(doc).toMatchObject({
      'trace.id': 'abc123',
      'span.id': 's1',
      'transaction.id': 't1',
      'ecs.version': '8.10.0'
    })
  })

  test('keeps long values in full', () => {
    const full = `https://example.com/${'a'.repeat(500)}`
    const { doc } = send({ message: 'hi', url: { full } })

    expect(doc.url.full).toBe(full)
  })

  test('adds the service name and version, overriding the app values', () => {
    const { doc } = send(pinoBase)

    expect(doc.service).toEqual({ name: 'example-backend', version: '1.2.3' })
  })

  test('applies the redactions', () => {
    const { doc } = send({
      message: 'Contact jo@example.com now',
      url: { full: 'https://example.com/?user=jo&password=secret&x=1' }
    })

    expect(doc.message).toBe('Contact****** now')
    expect(doc.url.full).toBe('https://example.com/?******&******&x=1')
  })
})

describe('Fluent Bit stage', () => {
  test('drops successful /health request logs', () => {
    expect(
      send({ req: { url: '/health' }, res: { statusCode: 200 } }).outcome
    ).toBe('health-check')
    expect(
      send({ url: { path: '/health' }, http: { 'response.status_code': 204 } })
        .outcome
    ).toBe('health-check')
  })

  test('keeps /health logs whose status code is a float, like int_key', () => {
    expect(
      send('{"req":{"url":"/health"},"res":{"statusCode":200.0}}').outcome
    ).toBe('indexed')
  })

  test('drops /health logs where the app logged status_code_str itself', () => {
    expect(
      send({ req: { url: '/health' }, status_code_str: '200' }).outcome
    ).toBe('health-check')
  })

  test('keeps failed /health request logs', () => {
    expect(
      send({ req: { url: '/health' }, res: { statusCode: 500 } }).outcome
    ).toBe('indexed')
  })

  test('warns when log.level looks like audit but is not exactly "audit"', () => {
    const result = send({ 'log.level': 'AUDIT', message: 'x' })

    expect(result.outcome).toBe('indexed')
    expect(formatResult(result).stderr).toContain(
      'warning: log.level "AUDIT" is not "audit" (case-sensitive)'
    )
    expect(send({ 'log.level': 'info' }).warnings).toEqual([])
  })

  test('sends audit logs to the audit stream', () => {
    expect(send({ 'log.level': 'audit', message: 'x' }).outcome).toBe('audit')
  })
})

describe('OpenSearch Ingestion stage', () => {
  test('routes API gateway access logs away from cdp-logs', () => {
    expect(send({ message: 'x', api_gw_name: 'gw' }).outcome).toBe(
      'api-gateway'
    )
    expect(send({ message: { api_gw_name: 'gw' } }).outcome).toBe('api-gateway')
  })

  test('stores a line that is not JSON as an error message', () => {
    const { doc } = send('Server crashed: jo@example.com')

    expect(doc).toEqual({
      '@ingestion_timestamp': '2026-10-27T12:00:00.000Z',
      '@timestamp': '2026-10-27T12:00:00.000Z',
      'console.log': true,
      'log.level': 'error',
      message: 'Server crashed:******',
      service: { name: 'example-backend', version: '1.2.3' }
    })
  })

  test('maps a pino request log', () => {
    const { doc, report } = send(pinoRequest)

    expect(doc).toEqual({
      '@ingestion_timestamp': '2026-10-27T12:00:00.000Z',
      '@timestamp': '2026-10-27T11:59:59.123Z',
      client: { address: '127.0.0.1', port: 51234 },
      'ecs.version': '8.10.0',
      'host.hostname': 'example-host',
      http: {
        request: { id: '1730000000000:host:1234:abcd:10', method: 'get' },
        response: { response_time: 12, status_code: 200 }
      },
      'log.level': 'info',
      message: '[response] get /example?****** 200 (12ms)',
      process: { pid: 4242 },
      server: { address: 'localhost:3001' },
      service: { name: 'example-backend', version: '1.2.3' },
      'trace.id': 'f3a1c2d4e5b6a7980123456789abcdef',
      url: { path: '/example?******' },
      user_agent: { original: 'curl/8.9.1' }
    })
    expect(report.dropped).toEqual(
      expect.arrayContaining([
        'event.dataset',
        'req/query/password',
        'http/request/headers/cookie'
      ])
    )
  })

  test('maps a Serilog request log', () => {
    const { outcome, doc } = send(serilogRequest)

    expect(outcome).toBe('indexed')
    expect(doc).toMatchObject({
      'log.level': 'info',
      'trace.id': 'abc-123',
      log: { logger: 'Microsoft.AspNetCore.Hosting.Diagnostics' },
      process: { pid: 1, thread: { id: 7, name: 'worker' } },
      http: {
        request: { method: 'GET' },
        response: { status_code: 200, mime_type: 'application/json' }
      },
      service: { name: 'example-backend', version: '1.2.3', type: 'dotnet' }
    })
  })

  test('loses the level of a nested log object', () => {
    const { doc, report } = send({ log: { level: 'warn' }, message: 'x' })

    expect(doc['log.level']).toBeUndefined()
    expect(report.dropped).toContain('temp_log/level')
  })

  test.each([
    ['Trace', 'trace'],
    ['Debug', 'debug'],
    ['Information', 'info'],
    ['Warning', 'warn'],
    ['Critical', 'error']
  ])('normalises the .NET level %s', (level, expected) => {
    expect(send({ 'log.level': level }).doc['log.level']).toBe(expected)
  })

  test('compiles every redaction pattern as JS regex', () => {
    const patterns = pipelineProcessors.flatMap(
      (processor) => processor.obfuscate?.patterns ?? []
    )

    expect(patterns.length).toBeGreaterThan(0)
    patterns.forEach((pattern) =>
      expect(() => toJsRegExp(pattern)).not.toThrow()
    )
  })
})

describe('OpenSearch mapping', () => {
  test('rejects the whole line on a type conflict', () => {
    const result = send({ message: { text: 'object instead of string' } })

    expect(result.outcome).toBe('rejected')
    expect(result.errors).toEqual(['message: expected text, got an object'])
  })

  test('accepts the values OpenSearch coerces', () => {
    const { outcome } = send({
      message: 42,
      client: { port: '8080' },
      event: { created: 1730000000000, duration: '12' },
      '@timestamp': '2026-10-27T10:00:00,123Z'
    })

    expect(outcome).toBe('indexed')
  })

  test('rejects values OpenSearch cannot coerce', () => {
    const { errors } = send({
      client: { port: 'eighty' },
      event: { created: 'yesterday', duration: '0x10', severity: 1e20 }
    })

    expect(errors).toEqual([
      'client.port: expected long, got string "eighty"',
      'event.created: expected date, got string "yesterday"',
      'event.duration: expected long, got string "0x10"',
      'event.severity: expected long, got number 100000000000000000000'
    ])
  })
})

describe('formatResult', () => {
  test('prints indexed docs on stdout and explains on stderr', () => {
    const output = formatResult(send(pinoRequest), true)

    expect(JSON.parse(output.stdout)['trace.id']).toBe(
      'f3a1c2d4e5b6a7980123456789abcdef'
    )
    expect(output.stderr).toContain(
      'added by Fluent Bit: service.name=example-backend, service.version=1.2.3'
    )
    expect(output.stderr).toContain('renamed: req/url → url/path')
    expect(output.stderr).toContain('redacted: message, url/path')
    expect(output.stderr).toContain('not allowed, dropped: ')
  })

  test('prints rejected lines on stderr only', () => {
    const output = formatResult(send({ message: {} }))

    expect(output.stdout).toBe('')
    expect(output.stderr).toContain('cdp-broken-logs')
  })
})

describe('run', () => {
  test('rejects unknown options instead of throwing', async () => {
    await expect(run({ argv: ['--bogus'] })).rejects.toThrow('--bogus')
  })

  test('reads stdin and takes the service from package.json', async () => {
    const stdin = new PassThrough()
    const stdout = new PassThrough()
    const stderr = new PassThrough()
    const done = run({
      argv: [],
      env: {},
      cwd: new URL('..', import.meta.url).pathname,
      stdin,
      stdout,
      stderr
    })

    stdin.end('{"message":"hello"}\n\nnot json\n{"log.level":"audit"}\n')
    await done

    const docs = stdout.read().toString().trim().split('\n').map(JSON.parse)
    expect(docs.map((doc) => doc.message)).toEqual(['hello', 'not json'])
    expect(docs[0].service.name).toBe('@defra/cdp-log-pipeline')
    expect(stderr.read().toString()).toContain('audit log')
  })
})
