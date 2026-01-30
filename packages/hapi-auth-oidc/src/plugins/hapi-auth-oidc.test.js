import { describe, test, expect, vi, beforeEach } from 'vitest'
import Boom from '@hapi/boom'
import { HapiAuthOidcPlugin, asExternalUrl } from './hapi-auth-oidc.js'
import * as flow from '../oidc/flow.js'
import * as refresh from '../oidc/refresh.js'
import * as clientConfig from '../oidc/client-config.js'
import * as openid from 'openid-client'

vi.mock('../oidc/flow.js')
vi.mock('../oidc/refresh.js')
vi.mock('../oidc/client-config.js')
vi.mock('openid-client')

describe('#HapiAuthOidcPlugin.register', () => {
  let server

  beforeEach(() => {
    vi.clearAllMocks()

    server = {
      state: vi.fn(),
      expose: vi.fn(),
      decorate: vi.fn(),
      logger: {},
      auth: {
        scheme: vi.fn(),
        strategy: vi.fn()
      }
    }

    clientConfig.createOidcConfig.mockResolvedValue({})
    openid.allowInsecureRequests.mockImplementation(() => {})
  })

  test('Should register plugin and auth strategy', async () => {
    await HapiAuthOidcPlugin.register(server, validOptions())

    expect(server.state).toHaveBeenCalled()
    expect(server.auth.scheme).toHaveBeenCalledWith(
      'hapi-auth-oidc',
      expect.any(Function)
    )
    expect(server.auth.strategy).toHaveBeenCalledWith(
      'hapi-auth-oidc',
      'hapi-auth-oidc'
    )
  })

  test('Should expose validateAndRefreshToken', async () => {
    refresh.validateAndRefreshToken.mockResolvedValue({
      accessToken: 'access'
    })

    await HapiAuthOidcPlugin.register(server, validOptions())

    const exposedFn = server.expose.mock.calls[0][1]

    const result = await exposedFn({
      refreshToken: 'refresh',
      accessToken: 'access'
    })

    expect(result.accessToken).toBe('access')
  })

  test('Should decorate request when refresh decoration is enabled', async () => {
    await HapiAuthOidcPlugin.register(server, validOptions())

    expect(server.decorate).toHaveBeenCalledWith(
      'request',
      'validateAndRefreshToken',
      expect.any(Function)
    )
  })

  test('Should not decorate request when refresh decoration is disabled', async () => {
    const options = validOptions()
    options.oidc.enableRefreshDecoration = false

    await HapiAuthOidcPlugin.register(server, options)

    expect(server.decorate).not.toHaveBeenCalled()
  })

  test('Should return Boom unauthorized when preLogin throws', async () => {
    flow.preLogin.mockRejectedValue(new Error('prelogin failed'))

    let authenticate
    server.auth.scheme.mockImplementation((_name, factory) => {
      authenticate = factory().authenticate
    })

    await HapiAuthOidcPlugin.register(server, validOptions())

    const result = await authenticate(
      {
        query: {},
        state: {},
        url: 'http://internal/login',
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

    let authenticate
    server.auth.scheme.mockImplementation((_name, factory) => {
      authenticate = factory().authenticate
    })

    await HapiAuthOidcPlugin.register(server, options)

    const fakeRequest = {
      query: {}, // triggers preLogin
      state: {},
      url: 'http://internal/path',
      logger: {}
    }

    await authenticate(fakeRequest, {})

    const configArg = clientConfig.createOidcConfig.mock.calls[0][0]
    expect(configArg.discoveryRequestOptions.execute).toContain(
      openid.allowInsecureRequests
    )
  })

  test('Should not merge allowInsecureRequests when useHttp is false', async () => {
    const options = validOptions()
    options.oidc.useHttp = false
    options.oidc.discoveryRequestOptions = { execute: [] }

    let authenticate
    server.auth.scheme.mockImplementation((_name, factory) => {
      authenticate = factory().authenticate
    })

    await HapiAuthOidcPlugin.register(server, options)

    const fakeRequest = {
      query: {}, // triggers preLogin
      state: {},
      url: 'http://internal/path',
      logger: {}
    }

    await authenticate(fakeRequest, {})

    const configArg = clientConfig.createOidcConfig.mock.calls[0][0]
    expect(configArg.discoveryRequestOptions.execute).not.toContain(
      openid.allowInsecureRequests
    )
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
      loginCallbackUri: 'https://app/callback',
      externalBaseUrl: 'https://external.example.com',
      authProvider: {
        type: 'client_secret',
        getCredentials: vi.fn(async (_logger) => {})
      }
    },
    cookieOptions: {
      password: 'x'.repeat(32)
    }
  }
}
