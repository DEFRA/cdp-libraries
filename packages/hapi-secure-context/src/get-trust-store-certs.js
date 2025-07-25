import * as crypto from 'node:crypto'

/**
 * Get base64 certs from all environment variables starting with TRUSTSTORE_
 * @param {NodeJS.ProcessEnv} envs
 * @param {{prefix: null|string, keys: null|[string]}} options
 * @param {{ info: function }} logger
 * @returns {{}}
 */
function getTrustStoreCerts(envs, options = {}, logger = undefined) {
  const prefix = options.prefix ?? 'TRUSTSTORE_'

  const keys = Array.isArray(options.keys)
    ? options.keys
    : Object.keys(envs).filter((e) => e.startsWith(prefix))

  if (logger) logger.info(`Found ${keys.length} CA Certs to install`)

  const result = {}
  for (const key of keys) {
    const cert = parseAndValidateCACert(envs[key])
    if (envs[key] && cert) {
      if (logger) logger.info(`Loaded ${cert.subject} from ${key}`)
      result[key] = cert.toString()
    }
  }

  return result
}

/**
 * Decodes base64 certs and checks they are parsable/valid
 * @param {string} value - Base64 encoded CA Cert
 * @returns {null|crypto.X509Certificate} - Decoded cert
 */
function parseAndValidateCACert(value) {
  try {
    const decodedValue = Buffer.from(value, 'base64').toString().trim()
    return new crypto.X509Certificate(decodedValue)
  } catch (err) {
    return null
  }
}

export { getTrustStoreCerts }
