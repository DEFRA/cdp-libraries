import jwt from '@hapi/jwt'
import {
  CognitoIdentityClient,
  GetOpenIdTokenForDeveloperIdentityCommand
} from '@aws-sdk/client-cognito-identity'

/**
 * Provides a federated Cognito token for a given identity pool.
 *
 * - Caches the token internally and refreshes it if expired or within the early refresh window.
 * - Supports an optional `earlyRefreshMs` to refresh slightly before actual expiry.
 * - Designed for use with developer-authenticated identities.
 */
export class CognitoTokenProvider {
  #token = null
  #refreshPromise = null

  /**
   * Creates a new CognitoTokenProvider instance.
   *
   * @param {Object} params
   * @param {string} params.poolId - The Cognito Identity Pool ID.
   * @param {Object<string,string>} [params.logins={}] - Optional logins map for federated identities.
   *   Keys are developer provider names, values are user IDs.
   * @param {CognitoIdentityClient} [params.cognitoClient] - Optional AWS CognitoIdentityClient instance.
   * @param {number} [params.earlyRefreshMs=0] - Time in milliseconds to refresh token before actual expiry.
   *
   * @throws {Error} If `poolId` is not provided.
   */
  constructor({
    poolId,
    logins = {},
    cognitoClient = new CognitoIdentityClient(),
    earlyRefreshMs = 0
  }) {
    if (!poolId) throw new Error('poolId is required')
    this.poolId = poolId
    this.logins = logins
    this.cognitoClient = cognitoClient
    this.type = 'federated'
    this.earlyRefreshMs = earlyRefreshMs
  }

  /**
   * Requests a new Cognito token from the identity pool.
   *
   * @private
   * @param {Object} [logger] - Optional logger for debug/info messages.
   * @returns {Promise<string>} The issued JWT token.
   */
  async #request(logger) {
    const input = { IdentityPoolId: this.poolId, Logins: this.logins }
    const command = new GetOpenIdTokenForDeveloperIdentityCommand(input)
    const result = await this.cognitoClient.send(command)

    if (result) {
      logger?.info?.(`Result: ${JSON.stringify(result)}`)
      logger?.info?.(`Cognito token issued identityId: ${result.IdentityId}`)
    }

    return result?.Token
  }

  /**
   * Returns a valid Cognito token, refreshing it if expired or near expiry.
   *
   * - If a cached token exists and is not expired, returns it immediately.
   * - If the token is expired or within `earlyRefreshMs`, requests a new token.
   * - Ensures only one refresh request is in-flight at a time.
   *
   * @param {Object} [logger] - Optional logger for debug/info messages.
   * @returns {Promise<string>} A valid JWT token.
   */
  async getCredentials(logger) {
    if (
      this.#token &&
      !this.#tokenHasExpired(this.#token, this.earlyRefreshMs, logger)
    ) {
      return this.#token
    }

    if (!this.#refreshPromise) {
      logger?.info?.('[Cognito] creating refreshPromise')
      this.#refreshPromise = (async () => {
        try {
          const token = await this.#request(logger)
          if (token) {
            this.#token = token
            logger?.info?.('[Cognito] token cached successfully')
            return token
          } else {
            logger?.warn?.(
              '[Cognito] refresh returned undefined token — keeping previous token if present'
            )
            return this.#token
          }
        } catch (err) {
          logger?.error?.('[Cognito] refresh failed', err)
          return this.#token
        } finally {
          this.#refreshPromise = null
        }
      })()
    } else {
      logger?.info?.('[Cognito] awaiting existing refreshPromise')
    }

    return this.#refreshPromise
  }

  /**
   * Checks if a JWT token is expired or within the early refresh window.
   *
   * @private
   * @param {string} token - The JWT token to check.
   * @param {number} earlyRefreshMs - Milliseconds before actual expiry to treat token as expired.
   * @param {Object} [logger] - Optional logger for debug/info messages.
   * @returns {boolean} `true` if the token is expired or invalid, otherwise `false`.
   */
  #tokenHasExpired(token, earlyRefreshMs, logger) {
    try {
      logger?.info?.(`encoded token: ${token}`)
      const decoded = jwt.token.decode(token)
      logger?.info?.(
        `now: ${Date.now() + earlyRefreshMs}, decoded token: ${JSON.stringify(decoded)}`
      )
      jwt.token.verifyTime(decoded, { now: Date.now() + earlyRefreshMs })
      return false
    } catch (e) {
      logger?.info?.(`token validation error: ${e}`)
      return true
    }
  }
}
