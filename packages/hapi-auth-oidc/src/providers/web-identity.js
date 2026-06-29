import { GetWebIdentityTokenCommand, STSClient } from '@aws-sdk/client-sts'
import jwt from '@hapi/jwt'

/**
 * Provides a short-lived AWS STS Web Identity token.
 *
 * - Caches the token internally and refreshes it if expired or within the early refresh window.
 * - Supports an optional `earlyRefreshMs` to refresh slightly before actual expiry.
 * - Designed for use with developer-authenticated identities.
 */
export class WebIdentityTokenProvider {
  #token = null
  #refreshPromise = null

  /**
   * Creates a new CognitoTokenProvider instance.
   *
   * @param {Object} params
   * @param {string} params.audience - Audience value configured in the Entra ID federated credential.
   * @param {string} [params.signingAlgorithm='RS256'] - Optional JWT signing algorithm.
   * @param {STSClient} [params.stsClient] - Optional STS client.
   * @param {number} [params.durationSeconds=300] - Requested token lifetime.
   * @param {number} [params.earlyRefreshMs=0] - Refresh window before expiry.
   */
  constructor({
    audience,
    signingAlgorithm = 'RS256',
    stsClient = new STSClient(),
    durationSeconds = 300,
    earlyRefreshMs = 0
  }) {
    if (!audience) {
      throw new Error('audience is required')
    }

    this.audience = audience
    this.signingAlgorithm = signingAlgorithm
    this.stsClient = stsClient
    this.durationSeconds = durationSeconds
    this.earlyRefreshMs = earlyRefreshMs
    this.type = 'federated'
  }

  /**
   * Requests a new Web Identity token from AWS STS.
   *
   * @private
   * @param {Object} [logger]
   * @returns {Promise<string>}
   */
  async #request(logger) {
    const command = new GetWebIdentityTokenCommand({
      Audience: this.audience,
      SigningAlgorithm: this.signingAlgorithm,
      DurationSeconds: this.durationSeconds
    })

    const result = await this.stsClient.send(command)

    logger?.info?.('[Web Identity] token issued')

    return result.WebIdentityToken
  }

  /**
   * Returns a valid token, refreshing it if necessary.
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
      logger?.info?.('[Web Identity] creating refreshPromise')

      this.#refreshPromise = (async () => {
        try {
          const token = await this.#request(logger)

          if (token) {
            this.#token = token
            logger?.info?.('[Web Identity] token cached successfully')
          } else {
            logger?.warn?.(
              '[Web Identity] received empty token, keeping previous token'
            )
          }

          return this.#token
        } catch (err) {
          logger?.error?.(
            err,
            `[Web Identity] refresh failed. Error: ${err.message}`
          )
          return this.#token
        } finally {
          this.#refreshPromise = null
        }
      })()
    } else {
      logger?.info?.('[Web Identity] awaiting existing refreshPromise')
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
      const decoded = jwt.token.decode(token)
      jwt.token.verifyTime(decoded, { now: Date.now() + earlyRefreshMs })
      return false
    } catch (err) {
      logger?.info?.(
        err,
        `[Web Identity] token validation error: ${err.message}`
      )
      return true
    }
  }
}
