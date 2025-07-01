import { describe, test, expect } from 'vitest'
import { getTrustStoreCerts } from './get-trust-store-certs.js'

describe('#getTrustStoreCerts', () => {
  const mockCert =
    '-----BEGIN CERTIFICATE-----\nmock-cert-doris\n-----END CERTIFICATE-----'

  const mockProcessEnvWithCerts = {
    TRUSTSTORE_CA_ONE: Buffer.from(mockCert).toString('base64'),
    UNRELATED_ENV: 'not-a-cert'
  }

  test('Should provide expected result with "certs"', () => {
    expect(getTrustStoreCerts(mockProcessEnvWithCerts)).toEqual([mockCert])
  })

  test('Should provide expected empty array', () => {
    expect(getTrustStoreCerts({})).toEqual([])
  })
})
