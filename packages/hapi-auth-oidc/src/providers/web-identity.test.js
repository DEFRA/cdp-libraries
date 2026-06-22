import { beforeEach, describe, expect, test, vi } from 'vitest'
import { WebIdentityTokenProvider } from './web-identity.js'

vi.mock('@aws-sdk/client-sts', () => {
  const sendMock = vi.fn()
  return {
    STSClient: class {
      send = sendMock
    },
    GetWebIdentityTokenCommand: vi.fn(),
    __esModule: true,
    __mocks: { sendMock }
  }
})

vi.mock('@hapi/jwt', () => {
  const decodeMock = vi.fn()
  const verifyTimeMock = vi.fn()
  return {
    token: {
      decode: decodeMock,
      verifyTime: verifyTimeMock
    },
    __esModule: true,
    __mocks: { decodeMock, verifyTimeMock }
  }
})

describe('#WebIdentityTokenProvider', () => {
  let provider
  let sendMock, decodeMock, verifyTimeMock

  beforeEach(async () => {
    vi.clearAllMocks()

    provider = new WebIdentityTokenProvider({
      audience: 'api://test',
      earlyRefreshMs: 0
    })

    const stsModule = await import('@aws-sdk/client-sts')
    sendMock = stsModule.__mocks.sendMock

    const jwtModule = await import('@hapi/jwt')
    decodeMock = jwtModule.__mocks.decodeMock
    verifyTimeMock = jwtModule.__mocks.verifyTimeMock
  })

  test('refreshes token when cached token is expired', async () => {
    sendMock.mockResolvedValueOnce({
      WebIdentityToken: 'token-1'
    })

    sendMock.mockResolvedValueOnce({
      WebIdentityToken: 'token-2'
    })

    decodeMock.mockReturnValue({
      exp: Date.now() / 1000 + 60
    })

    verifyTimeMock.mockReturnValue(undefined)

    const first = await provider.getCredentials()

    expect(first).toBe('token-1')

    decodeMock.mockImplementation((token) => {
      if (token === 'token-1') {
        return { exp: 0 }
      }

      return { exp: Date.now() / 1000 + 60 }
    })

    verifyTimeMock.mockImplementation((decoded) => {
      if (decoded.exp === 0) {
        throw new Error('expired')
      }
    })

    const refreshed = await provider.getCredentials()

    expect(refreshed).toBe('token-2')
    expect(sendMock).toHaveBeenCalledTimes(2)
  })

  test('handles undefined token from refresh gracefully', async () => {
    sendMock.mockResolvedValueOnce(undefined)

    decodeMock.mockReturnValue({
      exp: 0
    })

    verifyTimeMock.mockImplementation(() => {
      throw new Error('expired')
    })

    const token = await provider.getCredentials()

    expect(token).toBeNull()
    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  test('does not make multiple refresh requests concurrently', async () => {
    let resolveSend

    const pending = new Promise((resolve) => {
      resolveSend = resolve
    })

    sendMock.mockImplementation(() => pending)

    const p1 = provider.getCredentials()
    const p2 = provider.getCredentials()

    resolveSend({
      WebIdentityToken: 'token-1'
    })

    const [t1, t2] = await Promise.all([p1, p2])

    expect(t1).toBe('token-1')
    expect(t2).toBe('token-1')
    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  test('logs error on refresh failure and returns previous token', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }

    sendMock.mockResolvedValueOnce({
      WebIdentityToken: 'old-token'
    })

    decodeMock.mockReturnValue({
      exp: Date.now() / 1000 + 60
    })

    verifyTimeMock.mockReturnValue(undefined)

    await provider.getCredentials()

    decodeMock.mockImplementation((token) =>
      token === 'old-token' ? { exp: 0 } : { exp: Date.now() / 1000 + 60 }
    )

    verifyTimeMock.mockImplementation(() => {
      throw new Error('expired')
    })

    sendMock.mockRejectedValueOnce(new Error('refresh failure'))

    const token = await provider.getCredentials(logger)

    expect(token).toBe('old-token')
    expect(logger.error).toHaveBeenCalled()
  })
})
