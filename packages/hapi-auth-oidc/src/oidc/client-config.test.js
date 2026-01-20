import * as openid from 'openid-client'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { createOidcConfig } from './client-config.js'

vi.mock('openid-client')

describe('#createOidcConfig', () => {
  const discoveryUri =
    'https://issuer.example.com/.well-known/openid-configuration'
  const clientId = 'my-client-id'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('Should create OIDC config with client_secret auth', async () => {
    const authProvider = {
      type: 'client_secret',
      getCredentials: vi.fn().mockResolvedValue('super-secret')
    }

    const discoveryMock = vi
      .spyOn(openid, 'discovery')
      .mockResolvedValue('oidc-config')

    const result = await createOidcConfig({
      discoveryUri,
      clientId,
      authProvider
    })

    expect(result).toBe('oidc-config')
    expect(authProvider.getCredentials).toHaveBeenCalled()

    expect(discoveryMock).toHaveBeenCalledWith(
      new URL(discoveryUri),
      clientId,
      {
        client_id: clientId,
        token_endpoint_auth_method: 'client_secret_post',
        client_secret: 'super-secret'
      },
      undefined,
      {}
    )
  })

  test('Should create OIDC config with federated auth', async () => {
    const authProvider = {
      type: 'federated',
      getCredentials: vi.fn().mockResolvedValue('jwt-assertion')
    }

    const discoveryMock = vi
      .spyOn(openid, 'discovery')
      .mockResolvedValue('oidc-config')

    const result = await createOidcConfig({
      discoveryUri,
      clientId,
      authProvider
    })

    expect(result).toBe('oidc-config')
    expect(authProvider.getCredentials).toHaveBeenCalled()

    const clientAuthentication = discoveryMock.mock.calls[0][3]
    expect(typeof clientAuthentication).toBe('function')
  })

  test('Should apply federated client authentication correctly', async () => {
    const authProvider = {
      type: 'federated',
      getCredentials: vi.fn().mockResolvedValue('jwt-assertion')
    }

    const body = {
      set: vi.fn()
    }

    const discoveryMock = vi
      .spyOn(openid, 'discovery')
      .mockResolvedValue('oidc-config')

    await createOidcConfig({
      discoveryUri,
      clientId,
      authProvider
    })

    const clientAuthentication = discoveryMock.mock.calls[0][3]

    await clientAuthentication(null, { client_id: clientId }, body)

    expect(body.set).toHaveBeenCalledWith('client_id', clientId)
    expect(body.set).toHaveBeenCalledWith(
      'client_assertion_type',
      'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'
    )
    expect(body.set).toHaveBeenCalledWith('client_assertion', 'jwt-assertion')
  })

  test('Should throw error for unsupported auth type', async () => {
    const authProvider = {
      type: 'unknown',
      getCredentials: vi.fn()
    }

    await expect(
      createOidcConfig({
        discoveryUri,
        clientId,
        authProvider
      })
    ).rejects.toThrow('Unsupported auth type: unknown')
  })
})
