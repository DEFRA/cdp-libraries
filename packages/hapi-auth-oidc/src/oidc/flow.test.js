import * as openid from 'openid-client'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { preLogin } from './flow.js'

vi.mock('openid-client')

describe('#preLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('Should redirect with PKCE parameters when server supports PKCE', async () => {
    vi.spyOn(openid, 'randomPKCECodeVerifier').mockReturnValue('verifier')
    vi.spyOn(openid, 'calculatePKCECodeChallenge').mockResolvedValue(
      'challenge'
    )
    vi.spyOn(openid, 'buildAuthorizationUrl').mockReturnValue(
      new URL('https://issuer/authorize')
    )

    const oidcConfig = {
      serverMetadata() {
        return {
          supportsPKCE() {
            return true
          }
        }
      }
    }

    const h = {
      redirect: vi.fn().mockReturnThis(),
      state: vi.fn().mockReturnThis(),
      takeover: vi.fn()
    }

    const opts = {
      cookie: 'oidc',
      oidc: {
        loginCallbackUri: 'https://app/callback',
        scope: 'openid'
      }
    }

    await preLogin({ oidcConfig, opts, h })

    expect(h.redirect).toHaveBeenCalledWith('https://issuer/authorize')
    expect(h.state).toHaveBeenCalledWith('oidc', {
      codeVerifier: 'verifier'
    })
    expect(h.takeover).toHaveBeenCalled()
  })

  test('Should use nonce when server does not support PKCE', async () => {
    vi.spyOn(openid, 'randomPKCECodeVerifier').mockReturnValue('verifier')
    vi.spyOn(openid, 'calculatePKCECodeChallenge').mockResolvedValue(
      'challenge'
    )
    vi.spyOn(openid, 'randomNonce').mockReturnValue('nonce')
    vi.spyOn(openid, 'buildAuthorizationUrl').mockReturnValue(
      new URL('https://issuer/authorize')
    )

    const oidcConfig = {
      serverMetadata() {
        return {
          supportsPKCE() {
            return false
          }
        }
      }
    }

    const h = {
      redirect: vi.fn().mockReturnThis(),
      state: vi.fn().mockReturnThis(),
      takeover: vi.fn()
    }

    const opts = {
      cookie: 'oidc',
      oidc: {
        loginCallbackUri: 'https://app/callback',
        scope: 'openid'
      }
    }

    await preLogin({ oidcConfig, opts, h })

    expect(h.state).toHaveBeenCalledWith('oidc', {
      codeVerifier: 'verifier',
      nonce: 'nonce'
    })
  })
})
