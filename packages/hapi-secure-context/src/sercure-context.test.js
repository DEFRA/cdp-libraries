import { vi, beforeEach, expect, describe, test } from 'vitest'
import { secureContext } from './secure-context.js'
import tls from 'node:tls'

describe('#secure-context', () => {
  const originalSecureContext = tls.createSecureContext

  const server = {
    decorate: vi.fn()
  }

  beforeEach(() => {
    vi.resetAllMocks()
    vi.unstubAllEnvs()
    tls.createSecureContext = originalSecureContext
  })

  test('it doesnt fail if no custom certs are set', () => {
    const defaultContext = tls.createSecureContext()

    secureContext.plugin.register(server, {})
    expect(server.decorate).toHaveBeenCalledWith(
      'server',
      'secureContext',
      defaultContext
    )
    expect(server.decorate).toHaveBeenCalledWith('server', 'customCACerts', {})
  })

  test('it loads custom ca-certs when set as environment variables', () => {
    vi.stubEnv('TRUSTSTORE_FOO', mockCertB64)

    secureContext.plugin.register(server, {})
    expect(server.decorate).toHaveBeenCalledWith(
      'server',
      'secureContext',
      expect.any(Object)
    )
    expect(server.decorate).toHaveBeenCalledWith('server', 'customCACerts', {
      TRUSTSTORE_FOO: mockCert
    })
  })

  test('it ignores invalid truststore certs', () => {
    vi.stubEnv('TRUSTSTORE_FOO', mockCertB64)
    vi.stubEnv('TRUSTSTORE_BAR', 'an invalid cert')

    secureContext.plugin.register(server, {})
    expect(server.decorate).toHaveBeenCalledWith(
      'server',
      'secureContext',
      expect.any(Object)
    )
    expect(server.decorate).toHaveBeenCalledWith('server', 'customCACerts', {
      TRUSTSTORE_FOO: mockCert
    })
  })

  test('it loads custom ca-certs using a custom prefix', () => {
    vi.stubEnv('CACERT_FOO', mockCertB64)

    secureContext.plugin.register(server, { prefix: 'CACERT_' })
    expect(server.decorate).toHaveBeenCalledWith(
      'server',
      'secureContext',
      expect.any(Object)
    )
    expect(server.decorate).toHaveBeenCalledWith('server', 'customCACerts', {
      CACERT_FOO: mockCert
    })
  })

  test('it loads custom ca-certs using an allow list of keys', () => {
    vi.stubEnv('DONT_LOAD_THIS_ONE', mockCertB64)
    vi.stubEnv('MONGO_CERT', mockCertB64)

    secureContext.plugin.register(server, { keys: ['MONGO_CERT'] })
    expect(server.decorate).toHaveBeenCalledWith(
      'server',
      'secureContext',
      expect.any(Object)
    )
    expect(server.decorate).toHaveBeenCalledWith('server', 'customCACerts', {
      MONGO_CERT: mockCert
    })
  })
})

const mockCert =
  '-----BEGIN CERTIFICATE-----\n' +
  'MIIDCTCCAfGgAwIBAgIUBN2ZsEnvRuoO1qNYwuyE9W8dOIgwDQYJKoZIhvcNAQEL\n' +
  'BQAwFDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI1MDcyMjE4NDQzMVoXDTI2MDcy\n' +
  'MjE4NDQzMVowFDESMBAGA1UEAwwJbG9jYWxob3N0MIIBIjANBgkqhkiG9w0BAQEF\n' +
  'AAOCAQ8AMIIBCgKCAQEAvDLnPatMp1/hRQ6TZC5fbVQ1nU48RbOEzlJ+zXENrSU0\n' +
  'E+8QtgsqvQCpNQHMcafBwbM4cDbcUY2MhJOCECehZEOndZJFEsimX9km2//1gjGG\n' +
  'J/VccYEWKR4Trt5Yc0Sazxq8xvUKFxyk5TLzMi4k0HzCK/NZmrkc88vEbw/tmcFm\n' +
  'qDiGPkHSWIokPCbaOmtu8f+UK3MLF+E6xSW6Du/p7bo+HSTAeiaxQVxniHe/kLZ7\n' +
  'WROGIZYt66nKtCY2PlDDh8r/9t6CnF2fGA5p1kd5QPdtT07HwMI4XLJHIeLwkrqx\n' +
  'EUEXZU+W7siETDm7P9ofNqChI7YDa5AMlGmXsKpLFwIDAQABo1MwUTAdBgNVHQ4E\n' +
  'FgQULcn+/ruMiLKXfAuVf/M+gcHy/KUwHwYDVR0jBBgwFoAULcn+/ruMiLKXfAuV\n' +
  'f/M+gcHy/KUwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAZz5I\n' +
  'vVnj0y7UF2NoHD4rh9cJ7SlGN/phQOwwq4Z3hjkx5eJXEPwDY5rIUFLxdcmBR93j\n' +
  'ujxnF4DahkpbF2CaBbqQxxgrJ4JjS/8N/QTInS4vv7KeNxzRuOCL9i5YsJ73Aa80\n' +
  'NWat0cY1dxCkqL9Sr0SKZ1HnK+yaXRs6Gfrjn12SqlOg7X69XY626P+LtzE4IHdA\n' +
  '5tq523dbaLQJ9lA+CsbBAjXKm/I/0EvrS2aVXDvF4ay9BYiJC3NRlX+oIKl0NYLy\n' +
  'zc6Ir6vfFpmfgGVgPObu7vPv0u69O3ohrg5hLCaTrY72p8ZETrZKbaLoBTRwQaFS\n' +
  'ZQDfMVnXwd4c6+f2Jg==\n' +
  '-----END CERTIFICATE-----\n'

const mockCertB64 = Buffer.from(mockCert).toString('base64').trim()
