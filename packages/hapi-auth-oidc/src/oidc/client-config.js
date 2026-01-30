import * as openid from 'openid-client'
import assert from 'assert'

/**
 * Creates an OIDC configuration by discovering endpoints and setting up client authentication.
 * Supports 'client_secret' and 'federated' auth types.
 *
 * @param {Object} params
 * @param {string} params.discoveryUri
 *   The OIDC discovery URL (well-known configuration endpoint).
 * @param {string} params.clientId
 *   The client ID to use for authentication.
 * @param {Object} params.authProvider
 *   An auth provider implementing `{ type: string, getCredentials(logger?: Object): Promise<string> }`.
 *   Supported types: 'client_secret', 'federated'.
 * @param {Object} [params.discoveryRequestOptions={}]
 *   Optional options to pass to the discovery request (e.g., allowInsecureRequests).
 * @param {Object} [params.logger]
 *   Optional logger for debugging.
 *
 * @returns {Promise<import('openid-client').Configuration>}
 *   The discovered OIDC client, ready to perform authorization and token exchanges.
 *
 * @throws {Error}
 *   If the `authProvider.type` is unsupported.
 */
export async function createOidcConfig({
  discoveryUri,
  clientId,
  authProvider,
  discoveryRequestOptions = {},
  logger
}) {
  // Validate supported auth types early
  assert(
    authProvider.type === 'client_secret' || authProvider.type === 'federated',
    `Unsupported auth type: ${String(authProvider?.type)}`
  )

  const discoveryUrl = new URL(discoveryUri)
  const credential = await authProvider.getCredentials(logger)

  const metadata =
    authProvider.type === 'client_secret'
      ? {
          client_id: clientId,
          token_endpoint_auth_method: 'client_secret_post',
          client_secret: credential
        }
      : {}

  const clientAuthentication =
    authProvider.type === 'federated'
      ? async (_as, client, body) => {
          body.set('client_id', client.client_id)
          body.set(
            'client_assertion_type',
            'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'
          )
          body.set('client_assertion', credential)
        }
      : undefined

  return openid.discovery(
    discoveryUrl,
    clientId,
    metadata,
    clientAuthentication,
    discoveryRequestOptions
  )
}
