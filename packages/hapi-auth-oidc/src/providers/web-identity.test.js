import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { WebIdentityTokenProvider } from './web-identity.js'

vi.mock('@aws-sdk/client-sts', () => {
  const sendMock = vi.fn()
  const credentialsMock = vi.fn()

  return {
    STSClient: class {
      send = sendMock
      config = {
        credentials: credentialsMock
      }
    },
    GetWebIdentityTokenCommand: class {
      constructor(input) {
        this.input = input
      }
    },
    __esModule: true,
    __mocks: { sendMock, credentialsMock }
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
  let sendMock
  let decodeMock
  let verifyTimeMock
  let credentialsMock

  const now = new Date('2026-10-01T12:00:00.000Z')

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    vi.clearAllMocks()

    provider = new WebIdentityTokenProvider({
      audience: 'api://test',
      earlyRefreshMs: 0
    })

    const stsModule = await import('@aws-sdk/client-sts')
    sendMock = stsModule.__mocks.sendMock
    credentialsMock = stsModule.__mocks.credentialsMock

    const jwtModule = await import('@hapi/jwt')
    decodeMock = jwtModule.__mocks.decodeMock
    verifyTimeMock = jwtModule.__mocks.verifyTimeMock

    credentialsMock.mockResolvedValue({
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key',
      sessionToken: 'session-token',
      expiration: new Date('2026-10-02T13:00:00.000Z')
    })

    decodeMock.mockReturnValue({
      exp: Date.now() / 1000 + 60
    })

    verifyTimeMock.mockReturnValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('refreshes token when cached token is expired', async () => {
    sendMock
      .mockResolvedValueOnce({ WebIdentityToken: 'token-1' })
      .mockResolvedValueOnce({ WebIdentityToken: 'token-2' })

    const first = await provider.getCredentials()

    expect(first).toBe('token-1')

    decodeMock.mockImplementation((token) =>
      token === 'token-1' ? { exp: 0 } : { exp: Date.now() / 1000 + 60 }
    )

    verifyTimeMock.mockImplementation((decoded) => {
      if (decoded.exp === 0) {
        throw new Error('expired')
      }
    })

    const refreshed = await provider.getCredentials()

    expect(refreshed).toBe('token-2')
    expect(sendMock).toHaveBeenCalledTimes(2)
  })

  test('requests the configured duration when the parent session has sufficient lifetime', async () => {
    provider = new WebIdentityTokenProvider({
      audience: 'api://test',
      durationSeconds: 300,
      safetyMarginSeconds: 10
    })

    credentialsMock.mockResolvedValue({
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key',
      sessionToken: 'session-token',
      expiration: new Date('2026-10-02T13:00:00.000Z')
    })

    sendMock.mockResolvedValueOnce({
      WebIdentityToken: 'token-1'
    })

    await provider.getCredentials()

    const command = sendMock.mock.calls[0][0]

    expect(command.input.DurationSeconds).toBe(300)
  })

  test('reduces the requested duration when the parent session expires sooner', async () => {
    provider = new WebIdentityTokenProvider({
      audience: 'api://test',
      durationSeconds: 300,
      safetyMarginSeconds: 10
    })

    credentialsMock.mockResolvedValue({
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key',
      sessionToken: 'session-token',
      expiration: new Date('2026-10-01T12:02:00.000Z')
    })

    sendMock.mockResolvedValueOnce({
      WebIdentityToken: 'token-1'
    })

    await provider.getCredentials()

    const command = sendMock.mock.calls[0][0]

    expect(command.input.DurationSeconds).toBe(110)
  })

  test('subtracts the safety margin from the remaining parent session lifetime', async () => {
    provider = new WebIdentityTokenProvider({
      audience: 'api://test',
      durationSeconds: 300,
      safetyMarginSeconds: 10
    })

    credentialsMock.mockResolvedValue({
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key',
      sessionToken: 'session-token',
      expiration: new Date('2026-10-01T12:01:05.000Z')
    })

    sendMock.mockResolvedValueOnce({
      WebIdentityToken: 'token-1'
    })

    await provider.getCredentials()

    const command = sendMock.mock.calls[0][0]

    expect(command.input.DurationSeconds).toBe(55)
  })

  test('handles undefined token from refresh gracefully', async () => {
    sendMock.mockResolvedValueOnce(undefined)

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

    const first = await provider.getCredentials()

    expect(first).toBe('old-token')

    decodeMock.mockImplementation((token) =>
      token === 'old-token' ? { exp: 0 } : { exp: Date.now() / 1000 + 60 }
    )

    verifyTimeMock.mockImplementation((decoded) => {
      if (decoded.exp === 0) {
        throw new Error('expired')
      }
    })

    sendMock.mockRejectedValueOnce(new Error('refresh failure'))

    const token = await provider.getCredentials(logger)

    expect(token).toBe('old-token')
    expect(logger.error).toHaveBeenCalled()
  })
})
