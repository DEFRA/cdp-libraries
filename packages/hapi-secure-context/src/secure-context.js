import tls from 'node:tls'
import { getTrustStoreCerts } from './get-trust-store-certs.js'

/**
 * Creates a new secure context loaded from Base64 encoded certs
 * @satisfies {ServerRegisterPluginObject<void>}
 */
export const secureContext = {
  plugin: {
    name: 'secure-context',
    register(server, options) {
      const customCaCerts = getTrustStoreCerts(process.env, options)
      if (server.logger?.info) {
        server.logger.info(
          `Found ${customCaCerts.length} TRUSTSTORE_ certificates to install`
        )
        Object.values(customCaCerts).forEach((cert) =>
          server.logger.info(`Found custom cert: ${cert.subject}`)
        )
      }

      if (customCaCerts) {
        patchSecureContext(Object.values(customCaCerts).map((ca) => ca))
      }

      server.decorate('server', 'secureContext', tls.createSecureContext())
      server.decorate('server', 'customCACerts', customCaCerts)
    }
  }
}

function patchSecureContext(customCaCerts) {
  const originalTlsCreateSecureContext = tls.createSecureContext
  const defaultCAs = tls.rootCertificates

  tls.createSecureContext = function (options = {}) {
    const mergedCa = [
      ...(Array.isArray(options.ca)
        ? options.ca
        : options.ca
          ? [options.ca]
          : []),
      ...defaultCAs,
      ...customCaCerts
    ]

    const newOptions = { ...options, ca: mergedCa }
    return originalTlsCreateSecureContext(newOptions)
  }
}
