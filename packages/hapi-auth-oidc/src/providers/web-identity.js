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
  #providerId = null

  /**
   * Creates a new CognitoTokenProvider instance.
   *
   * @param {Object} params
   * @param {string[]} [params.audience] - Audience values configured in the Entra ID federated credential.
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
    earlyRefreshMs = 0,
    safetyMarginSeconds = 10
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
    this.#providerId = crypto.randomUUID()
    this.safetyMarginSeconds = safetyMarginSeconds
  }

  /**
   * Requests a new Web Identity token from AWS STS.
   *
   * @private
   * @param {number} durationSeconds - Requested token lifetime.
   * @param {Object} [logger]
   * @returns {Promise<string>}
   */
  async #request(durationSeconds, logger) {
    const command = new GetWebIdentityTokenCommand({
      Audience: this.audience,
      SigningAlgorithm: this.signingAlgorithm,
      DurationSeconds: durationSeconds
    })

    const result = await this.stsClient.send(command)

    logger?.info?.(
      { event: { reference: this.#providerId } },
      '[Web Identity] token issued'
    )

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
      logger?.info?.(
        { event: { reference: this.#providerId } },
        '[Web Identity] creating refreshPromise'
      )

      this.#refreshPromise = (async () => {
        try {
          const credentials = await this.stsClient.config.credentials({
            forceRefresh: true
          })

          const remainingMs = credentials.expiration.getTime() - Date.now()

          const durationSeconds = Math.min(
            this.durationSeconds,
            Math.floor(remainingMs / 1000) - this.safetyMarginSeconds
          )

          if (durationSeconds < this.durationSeconds) {
            logger?.warn?.(
              { event: { reference: this.#providerId } },
              `[Web Identity] parent AWS session has ${remainingMs} millis remaining`
            )
          }

          const token = await this.#request(durationSeconds, logger)

          if (token) {
            this.#token = token
            logger?.info?.(
              { event: { reference: this.#providerId } },
              '[Web Identity] token cached successfully'
            )
          } else {
            logger?.warn?.(
              { event: { reference: this.#providerId } },
              '[Web Identity] received empty token, keeping previous token'
            )
          }

          return this.#token
        } catch (err) {
          logger?.error?.(
            { event: { reference: this.#providerId }, err },
            `[Web Identity] refresh failed. Error: ${err.message}`
          )
          return this.#token
        } finally {
          this.#refreshPromise = null
        }
      })()
    } else {
      logger?.info?.(
        { event: { reference: this.#providerId } },
        '[Web Identity] awaiting existing refreshPromise'
      )
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
        { event: { reference: this.#providerId }, err },
        `[Web Identity] token validation error: ${err.message}`
      )
      return true
    }
  }
}
