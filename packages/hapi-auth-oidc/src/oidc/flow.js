import * as openid from 'openid-client'
import assert from 'assert'

/**
 * Initiates the OIDC login flow.
 *
 * Generates a PKCE code verifier and challenge, constructs the authorization URL,
 * and stores the PKCE verifier (and nonce if PKCE is unsupported) in a cookie.
 *
 * @param {Object} params
 * @param {import('openid-client').Configuration} params.oidcConfig
 *   The OIDC client configuration from discovery.
 * @param {Object} params.opts
 *   Options including OIDC settings and cookie name.
 * @param {import('@hapi/hapi').ResponseToolkit} params.h
 *   Hapi response toolkit for generating responses.
 * @param {Object} [params.logger]
 *   Optional logger for debug/info messages.
 * @returns {import('@hapi/hapi').ResponseObject}
 *   A redirect response to the OIDC provider with state cookie set.
 * @throws {Error} If URL construction fails (e.g., invalid redirect URI).
 */
export async function preLogin({ oidcConfig, opts, h, logger }) {
  const codeVerifier = openid.randomPKCECodeVerifier()
  const codeChallenge = await openid.calculatePKCECodeChallenge(codeVerifier)

  const params = {
    redirect_uri: opts.oidc.loginCallbackUri,
    scope: opts.oidc.scope,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  }

  const cookieValue = { codeVerifier }

  if (!oidcConfig.serverMetadata().supportsPKCE()) {
    logger?.debug?.("Server doesn't support PKCE; using nonce")
    const nonce = openid.randomNonce()
    params.nonce = nonce
    cookieValue.nonce = nonce
  }

  const redirectUrl = openid.buildAuthorizationUrl(oidcConfig, params)
  logger?.debug(`[PreLogin] - redirectUrl: ${redirectUrl}`)
  return h
    .redirect(redirectUrl.toString())
    .state(opts.cookie, cookieValue)
    .takeover()
}

/**
 * Handles the OIDC callback after login.
 * Validates the PKCE code verifier or nonce and exchanges the authorization code for tokens.
 *
 * @param {Object} params
 * @param {string} [params.codeVerifier]
 *   The PKCE code verifier from the preLogin cookie.
 * @param {string} [params.nonce]
 *   The nonce from the preLogin cookie (used when PKCE is unsupported).
 * @param {import('openid-client').Configuration} params.oidcConfig
 *   The resolved OIDC client configuration.
 * @param {URL} params.currentUrl
 *   The full callback URL received from the OIDC provider.
 * @param {Object} [params.logger]
 *   Optional logger.
 *
 * @returns {Promise<{
 *   expiresIn: number,
 *   accessToken: string,
 *   refreshToken: string,
 *   idToken: string,
 *   claims: Object
 * }>}
 * Tokens and ID token claims returned by the OIDC provider.
 *
 * @throws {Error}
 * If the PKCE verifier / nonce is missing or token validation fails.
 */
export async function postLogin({
  codeVerifier,
  nonce,
  oidcConfig,
  currentUrl,
  logger
}) {
  // These values are set in the preLogin, if they are missing its probably because
  // user has gone directly to the redirect link or refreshed etc.
  assert(
    codeVerifier || nonce,
    'Missing PKCE verifier/nonce in session; try logging in again'
  )

  logger?.info?.('validating token')
  const token = await openid.authorizationCodeGrant(oidcConfig, currentUrl, {
    pkceCodeVerifier: codeVerifier,
    expectedNonce: nonce,
    idTokenExpected: true
  })

  assert(token, 'Failed to validate token')

  const {
    access_token: accessToken,
    refresh_token: refreshToken,
    id_token: idToken
  } = token
  const claims = token.claims()
  const expiresIn = token.expiresIn()
  return { accessToken, refreshToken, idToken, claims, expiresIn }
}
