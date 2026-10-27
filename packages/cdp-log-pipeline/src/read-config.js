import { readFileSync } from 'node:fs'

// src/config/*.json, copied from cdp-opensearch-core by refresh-config.sh
export const readConfig = (name) =>
  JSON.parse(readFileSync(new URL(`./config/${name}`, import.meta.url)))
