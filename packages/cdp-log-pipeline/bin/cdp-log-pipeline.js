#!/usr/bin/env node
import { run } from '../src/cli.js'

run().catch((error) => {
  process.stderr.write(`[cdp-log-pipeline] ${error.message}\n`)
  process.exitCode = 1
})
