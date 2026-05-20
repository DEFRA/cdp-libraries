import * as openid from 'openid-client'
import Jwt from '@hapi/jwt'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ensureValidToken, refreshToken } from './refresh'

vi.mock('openid-client')
vi.mock('@hapi/jwt')

describe('#ensureValidToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('Should return existing token when access token is still valid', async () => {
    vi.spyOn(Jwt.token, 'decode').mockReturnValue({ name: 'user' })
    vi.spyOn(Jwt.token, 'verifyTime').mockImplementation(() => {})

    const token = { accessToken: 'access', refreshToken: 'refresh' }
    const { token: result, refreshed } = await ensureValidToken(token, vi.fn())

    expect(refreshed).toBeFalsy()
    expect(result).toBe(token)
  })

  test('Should refresh token when access token is expiring', async () => {
    vi.spyOn(Jwt.token, 'decode').mockReturnValue({ name: 'user' })
    vi.spyOn(Jwt.token, 'verifyTime').mockImplementation(() => {
      throw new Error('expired')
    })

    const refreshSpy = vi.spyOn(openid, 'refreshTokenGrant').mockResolvedValue({
      access_token: 'new-access',
      refresh_token: 'new-refresh'
    })

    const getOidcConfig = vi.fn().mockResolvedValue({})

    const { token: result } = await ensureValidToken(
      { accessToken: 'access', refreshToken: 'refresh' },
      getOidcConfig
    )

    expect(refreshSpy).toHaveBeenCalled()
    expect(result.accessToken).toBe('new-access')
    expect(result.refreshToken).toBe('new-refresh')
  })

  test('Should rethrow error if refresh fails', async () => {
    vi.spyOn(Jwt.token, 'decode').mockReturnValue({ name: 'user' })
    vi.spyOn(Jwt.token, 'verifyTime').mockImplementation(() => {
      throw new Error('expired')
    })

    vi.spyOn(openid, 'refreshTokenGrant').mockRejectedValue(
      new Error('refresh failed')
    )

    const getOidcConfig = vi.fn().mockResolvedValue({})

    await expect(
      ensureValidToken(
        { accessToken: 'access', refreshToken: 'refresh' },
        getOidcConfig
      )
    ).rejects.toThrow('refresh failed')
  })
})

describe('#refreshToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('Should refresh token and normalize response', async () => {
    const token = {
      access_token: 'access',
      refresh_token: 'refresh',
      id_token: 'id',
      claims: vi.fn().mockReturnValue({ sub: 'user' }),
      expiresIn: vi.fn().mockReturnValue(3600)
    }

    vi.spyOn(openid, 'refreshTokenGrant').mockResolvedValue(token)

    const getOidcConfig = vi.fn().mockResolvedValue({})

    const result = await refreshToken('refresh', getOidcConfig)

    expect(result).toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
      idToken: 'id',
      claims: { sub: 'user' },
      expiresIn: 3600
    })
  })

  test('Should throw error when refresh token is missing', async () => {
    await expect(refreshToken(undefined, vi.fn())).rejects.toThrow(
      'Missing refresh token'
    )
  })

  test('Should pass scope to refreshTokenGrant when provided', async () => {
    vi.spyOn(openid, 'refreshTokenGrant').mockResolvedValue({
      access_token: 'access',
      refresh_token: 'refresh'
    })

    const getOidcConfig = vi.fn().mockResolvedValue({})

    await refreshToken('refresh', getOidcConfig, 'openid profile')

    expect(openid.refreshTokenGrant).toHaveBeenCalledWith({}, 'refresh', {
      scope: 'openid profile'
    })
  })
})
