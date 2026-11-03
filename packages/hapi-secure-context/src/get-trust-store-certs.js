import * as crypto from 'node:crypto'

/**
 * Get base64 certs from all environment variables starting with TRUSTSTORE_
 * @param {NodeJS.ProcessEnv} envs
 * @param {{prefix?: string, keys?: string[]}} options
 * @param {{ info?: Function, warn?: Function }} [logger]
 * @returns {Record<string, string>}
 */
export function getTrustStoreCerts(envs, options = {}, logger = undefined) {
  const prefix = options.prefix ?? 'TRUSTSTORE_'

  const keys = Array.isArray(options.keys)
    ? options.keys
    : Object.keys(envs).filter((e) => e.startsWith(prefix))

  logger?.info?.(`Checking ${keys.length} CA certificate configurations`)

  const result = {}

  for (const key of keys) {
    const value = envs[key]

    if (!value?.trim()) {
      logger?.warn?.(`Environment variable ${key} is not set or is empty`)
      continue
    }

    let cert

    try {
      cert = parseAndValidateCACert(value)
    } catch (e) {
      logger?.warn?.(
        e,
        `CA certificate from environment variable ${key} could not be loaded: ${e.message}`
      )
      continue
    }

    logger?.info?.(`Loaded ${cert.subject} from ${key}`)
    result[key] = cert.toString()
  }

  logger?.info?.(`Loaded ${Object.keys(result).length} CA certificates`)

  return result
}

/**
 * Decodes a Base64-encoded CA certificate and parses it as an X.509 certificate.
 * @param {string} value - Base64-encoded CA certificate
 * @returns {crypto.X509Certificate}
 * @throws {Error} If the decoded value cannot be parsed as an X.509 certificate
 */
function parseAndValidateCACert(value) {
  const decodedValue = Buffer.from(value, 'base64').toString().trim()
  return new crypto.X509Certificate(decodedValue)
}
