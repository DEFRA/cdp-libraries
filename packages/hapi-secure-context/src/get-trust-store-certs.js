import * as crypto from 'node:crypto'
/**
 * Get base64 certs from all environment variables starting with TRUSTSTORE_
 * @param {NodeJS.ProcessEnv} envs
 * @param {{prefix: null|string, keys: null|[string]}} options
 * @returns {{}}
 */
function getTrustStoreCerts(envs, options = {}) {
  const prefix = options.prefix ?? 'TRUSTSTORE_'

  const keys = Array.isArray(options.keys)
    ? options.keys
    : Object.keys(envs).filter((e) => e.startsWith(prefix))

  const result = {}
  for (const key of keys) {
    const cert = parseAndValidateCACert(envs[key])
    if (envs[key] && cert) {
      result[key] = cert
    }
  }

  return result
}

/**
 * Decodes base64 certs and checks they are parsable/valid
 * @param {string} value - Base64 encoded CA Cert
 * @returns {null|string} - Decoded cert
 */
function parseAndValidateCACert(value) {
  try {
    const decodedValue = Buffer.from(value, 'base64').toString().trim()
    const cert = new crypto.X509Certificate(decodedValue)
    return cert.toString()
  } catch (err) {
    return null
  }
}

export { getTrustStoreCerts }
