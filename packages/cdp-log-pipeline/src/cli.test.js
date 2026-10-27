import { PassThrough } from 'node:stream'
import { expect, test, vi } from 'vitest'

import { run } from './cli.js'

// A pipeline that fails on one line, to check the stream survives it
vi.mock('./log-pipeline.js', () => ({
  createPipeline: () => (line) => {
    if (line === 'boom') throw new Error('kaboom')
    return { outcome: 'indexed', doc: { message: line } }
  }
}))

test('reports a line it cannot process and carries on', async () => {
  const stdin = new PassThrough()
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  const done = run({ argv: [], env: {}, cwd: '/', stdin, stdout, stderr })

  stdin.end('boom\nnext\n')
  await done

  expect(stderr.read().toString()).toBe(
    '[cdp-log-pipeline] could not process line: kaboom\n'
  )
  expect(JSON.parse(stdout.read().toString())).toEqual({ message: 'next' })
})
