import Hapi from '@hapi/hapi'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import Boom from '@hapi/boom'
import { asExternalUrl, hapiAuthOidcPlugin } from './hapi-auth-oidc.js'
import * as flow from '../oidc/flow.js'
import * as refresh from '../oidc/refresh.js'
import * as clientConfig from '../oidc/client-config.js'
import * as openid from 'openid-client'

vi.mock('../oidc/flow.js', () => ({
  preLogin: vi.fn(),
  postLogin: vi.fn()
}))

vi.mock('../oidc/refresh.js', () => ({
  ensureValidToken: vi.fn()
}))

vi.mock('../oidc/client-config.js', () => ({
  createOidcConfig: vi.fn()
}))

vi.mock('openid-client', () => ({
  allowInsecureRequests: vi.fn()
}))

describe('#HapiAuthOidcPlugin', () => {
  let server

  beforeEach(() => {
    vi.clearAllMocks()
    server = Hapi.server()

    clientConfig.createOidcConfig.mockResolvedValue({})
    openid.allowInsecureRequests.mockImplementation(() => {})
  })

  test('Should register plugin', async () => {
    await server.register({
      plugin: hapiAuthOidcPlugin,
      options: validOptions()
    })

    expect(server.plugins['hapi-auth-oidc']).toBeDefined()

    expect(server.plugins['hapi-auth-oidc'].oidc.login).toEqual(
      expect.any(Function)
    )
    expect(server.plugins['hapi-auth-oidc'].oidc.callback).toEqual(
      expect.any(Function)
    )
    expect(server.plugins['hapi-auth-oidc'].oidc.ensureValidToken).toEqual(
      expect.any(Function)
    )
  })

  test('Should expose ensureValidToken', async () => {
    refresh.ensureValidToken.mockResolvedValue({
      token: { accessToken: 'access' },
      refreshed: true
    })

    await server.register({
      plugin: hapiAuthOidcPlugin,
      options: validOptions()
    })

    const exposedFn = server.plugins['hapi-auth-oidc'].oidc.ensureValidToken

    const result = await exposedFn(
      {},
      {
        refreshToken: 'refresh',
        accessToken: 'access'
      }
    )

    expect(result.token.accessToken).toBe('access')
    expect(result.refreshed).toBe(true)
  })

  test('Should decorate request', async () => {
    await server.register({
      plugin: hapiAuthOidcPlugin,
      options: validOptions()
    })

    server.route({
      method: 'GET',
      path: '/test',
      handler: (request) => ({
        hasEnsureValidToken: typeof request.ensureValidToken === 'function',
        hasOidcLogin: typeof request.login === 'function',
        hasOidcCallback: typeof request.callback === 'function'
      })
    })

    const res = await server.inject('/test')

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload)).toEqual({
      hasEnsureValidToken: true,
      hasOidcLogin: true,
      hasOidcCallback: true
    })
  })

  test('Should return Boom unauthorized when preLogin throws', async () => {
    flow.preLogin.mockRejectedValue(new Error('prelogin failed'))

    await server.register({
      plugin: hapiAuthOidcPlugin,
      options: validOptions()
    })

    const login = server.plugins['hapi-auth-oidc'].oidc.login

    const result = await login(
      {
        query: {},
        state: {},
        url: new URL('http://internal/login'),
        logger: {}
      },
      {}
    )

    expect(Boom.isBoom(result)).toBe(true)
    expect(result.output.statusCode).toBe(401)
  })

  test('Should merge allowInsecureRequests when useHttp is true', async () => {
    const options = validOptions()
    options.oidc.useHttp = true
    options.oidc.discoveryRequestOptions = { execute: [] }

    flow.preLogin.mockResolvedValue({})

    await server.register({
      plugin: hapiAuthOidcPlugin,
      options
    })

    const login = server.plugins['hapi-auth-oidc'].oidc.login

    await login(
      {
        query: {},
        state: {},
        url: new URL('http://internal/path'),
        logger: {}
      },
      {}
    )

    const configArg = clientConfig.createOidcConfig.mock.calls[0][0]
    expect(configArg.discoveryRequestOptions.execute).toContain(
      openid.allowInsecureRequests
    )
  })

  test('Should not merge allowInsecureRequests when useHttp is false', async () => {
    const options = validOptions()
    options.oidc.useHttp = false
    options.oidc.discoveryRequestOptions = { execute: [] }

    flow.preLogin.mockResolvedValue({})

    await server.register({
      plugin: hapiAuthOidcPlugin,
      options
    })

    const login = server.plugins['hapi-auth-oidc'].oidc.login

    await login(
      {
        query: {},
        state: {},
        url: new URL('http://internal/path'),
        logger: {}
      },
      {}
    )

    const configArg = clientConfig.createOidcConfig.mock.calls[0][0]
    expect(configArg.discoveryRequestOptions.execute).not.toContain(
      openid.allowInsecureRequests
    )
  })

  test('Should support route query callbacks to postLogin', async () => {
    const credentials = {
      accessToken: 'access',
      refreshToken: 'refresh',
      idToken: 'id',
      claims: {},
      expiresIn: 3600
    }

    flow.postLogin.mockResolvedValue(credentials)

    await server.register({
      plugin: hapiAuthOidcPlugin,
      options: validOptions()
    })

    const callback = server.plugins['hapi-auth-oidc'].oidc.callback

    const h = {
      unstate: vi.fn()
    }

    const result = await callback(
      {
        method: 'get',
        query: {
          code: 'auth-code',
          state: 'csrf-state'
        },
        payload: undefined,
        state: {
          'hapi-auth-oidc': {
            codeVerifier: 'verifier',
            state: 'csrf-state',
            nonce: 'nonce'
          }
        },
        url: 'http://internal/callback',
        logger: {}
      },
      h
    )

    expect(flow.preLogin).not.toHaveBeenCalled()

    expect(flow.postLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        codeVerifier: 'verifier',
        state: 'csrf-state',
        currentUrl: expect.anything()
      })
    )

    expect(h.unstate).toHaveBeenCalledWith('hapi-auth-oidc')
    expect(result).toEqual(credentials)
  })

  test('Should route form_post callback to postLogin', async () => {
    const credentials = {
      accessToken: 'access',
      refreshToken: 'refresh',
      idToken: 'id',
      claims: {},
      expiresIn: 3600
    }

    flow.postLogin.mockResolvedValue(credentials)

    await server.register({
      plugin: hapiAuthOidcPlugin,
      options: validOptions()
    })

    const callback = server.plugins['hapi-auth-oidc'].oidc.callback

    const h = {
      unstate: vi.fn()
    }

    const result = await callback(
      {
        method: 'post',
        query: {},
        payload: {
          code: 'auth-code',
          state: 'csrf-state'
        },
        state: {
          'hapi-auth-oidc': {
            codeVerifier: 'verifier',
            state: 'csrf-state',
            nonce: 'nonce'
          }
        },
        url: 'http://internal/callback',
        logger: {}
      },
      h
    )

    expect(flow.preLogin).not.toHaveBeenCalled()
    expect(flow.postLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        codeVerifier: 'verifier',
        state: 'csrf-state'
      })
    )
    expect(h.unstate).toHaveBeenCalledWith('hapi-auth-oidc')
    expect(result).toEqual(credentials)
  })
})

describe('#asExternalUrl', () => {
  test('Should rewrite URL using external base URL', () => {
    const result = asExternalUrl(
      'http://internal/path?x=1',
      'https://external.example.com:8443'
    )

    expect(result.protocol).toBe('https:')
    expect(result.hostname).toBe('external.example.com')
    expect(result.port).toBe('8443')
    expect(result.pathname).toBe('/path')
    expect(result.search).toBe('?x=1')
  })
})

function validOptions() {
  return {
    oidc: {
      discoveryUri: 'https://issuer/.well-known/openid-configuration',
      clientId: 'client-id',
      scope: 'openid',
      loginCallbackUri: '/callback',
      externalBaseUrl: 'https://external.example.com',
      authProvider: {
        type: 'client_secret',
        getCredentials: vi.fn(async (_logger) => {})
      }
    },
    cookie: 'hapi-auth-oidc',
    cookieOptions: {
      password: 'x'.repeat(32)
    }
  }
}
