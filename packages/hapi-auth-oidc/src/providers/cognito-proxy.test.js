import { CognitoTokenProvider } from './cognito.js'

describe('CognitoTokenProvider - Proxy Configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('attaches proxy agent when HTTPS_PROXY is set', async () => {
    vi.stubEnv('HTTPS_PROXY', 'https://example.com')

    const provider = new CognitoTokenProvider({ poolId: 'test-pool' })
    const handler = provider.cognitoClient.config.requestHandler
    const config = await handler.configProvider

    expect(config.httpsAgent).toBeDefined()

    const proxyUrl =
      config.httpsAgent.proxy?.href ||
      config.httpsAgent.options?.proxy?.href ||
      config.httpsAgent.options?.proxy
    expect(proxyUrl.toString()).toContain('example.com')
  })

  test('attaches proxy agent when HTTP_PROXY is set', async () => {
    vi.stubEnv('HTTP_PROXY', 'https://example.com')

    const provider = new CognitoTokenProvider({ poolId: 'test-pool' })
    const handler = provider.cognitoClient.config.requestHandler
    const config = await handler.configProvider

    expect(config.httpAgent).toBeDefined()

    const proxyUrl =
      config.httpAgent.proxy?.href ||
      config.httpAgent.options?.proxy?.href ||
      config.httpAgent.options?.proxy
    expect(proxyUrl.toString()).toContain('example.com')
  })

  test('does not attach proxy when environment variables are missing', async () => {
    vi.stubEnv('HTTPS_PROXY', '')
    vi.stubEnv('HTTP_PROXY', '')

    const provider = new CognitoTokenProvider({ poolId: 'test-pool' })
    const handler = provider.cognitoClient.config.requestHandler
    const config = await handler.configProvider

    const hasHttpProxy = !!(
      config.httpAgent?.proxy || config.httpAgent?.options?.proxy
    )
    const hasHttpsProxy = !!(
      config.httpsAgent?.proxy || config.httpsAgent?.options?.proxy
    )

    expect(hasHttpProxy).toBe(false)
    expect(hasHttpsProxy).toBe(false)
  })
})
