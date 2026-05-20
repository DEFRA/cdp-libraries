import * as openid from 'openid-client'
import Jwt from '@hapi/jwt'
import assert from 'assert'

/**
 * Validates an access token and refreshes it if it is about to expire.
 *
 * If the token is still valid, returns the original token object.
 * If the token is near expiry, refreshes and returns a new token object.
 * Throws an error if token refresh fails.
 *
 * @param {{refreshToken: string, accessToken: string }} token - Current token set.
 * @param {(logger?: { info?: Function, warn?: Function, debug?: Function }) => Promise<import('openid-client').Configuration>} getOidcConfig
 * @param {number} [earlyRefreshMs=60000] - Time in ms before expiry to trigger refresh.
 * @param {string} [scope] - Optional scope for refresh.
 * @param {{ info?: Function, warn?: Function, debug?: Function }} [logger]
 *
 * @returns {Promise<{
 *   token: { accessToken: string,
 *            refreshToken: string,
 *            idToken?: string,
 *            claims?: Record<string, any>,
 *            expiresIn?: number },
 *   refreshed: boolean
 * }>} The original token if still valid, or a refreshed token object.
 *
 * @throws {Error} If token refresh fails.
 */
export async function ensureValidToken(
  token,
  getOidcConfig,
  earlyRefreshMs = 60_000,
  scope,
  logger
) {
  const { refreshToken: jwtRefreshToken, accessToken } = token
  const decoded = Jwt.token.decode(accessToken)
  try {
    Jwt.token.verifyTime(decoded, { now: Date.now() + earlyRefreshMs })
    return { token, refreshed: false }
  } catch {
    logger?.info?.(
      `Token for user ${decoded?.name} expiring, attempting to refresh`
    )
  }
  try {
    const refreshedToken = await refreshToken(
      jwtRefreshToken,
      getOidcConfig,
      scope,
      logger
    )
    return { token: refreshedToken, refreshed: true }
  } catch (e) {
    logger?.warn?.(e, e.message)
    throw e
  }
}

/**
 * Performs a refresh token grant and returns a normalised token object.
 *
 * @param {string} jwtRefreshToken - JWT refresh token.
 * @param {Function} getOidcConfig - Async function returning the OIDC client configuration.
 * @param {string} [scope] - Optional scope for refresh.
 * @param {Object} [logger] - Optional logger.
 *
 * @returns {Promise<{
 *   accessToken: string,
 *   refreshToken: string,
 *   idToken?: string,
 *   claims?: Record<string, any>,
 *   expiresIn?: number
 * }>} The refreshed token object, or `undefined` if no refresh was needed.
 *
 *  @throws {Error} If refresh token is missing or refresh grant fails.
 */
export async function refreshToken(
  jwtRefreshToken,
  getOidcConfig,
  scope,
  logger
) {
  assert(jwtRefreshToken, 'Missing refresh token')
  const oidcConfig = await getOidcConfig(logger)
  const token = await openid.refreshTokenGrant(oidcConfig, jwtRefreshToken, {
    scope
  })

  const {
    access_token: accessToken,
    refresh_token: refreshToken,
    id_token: idToken
  } = token
  const claims = token.claims?.()
  const expiresIn = token.expiresIn?.()

  return { accessToken, refreshToken, idToken, claims, expiresIn }
}
