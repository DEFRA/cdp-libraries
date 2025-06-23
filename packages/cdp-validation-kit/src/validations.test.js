import { describe, test, expect } from 'vitest'
import {
  currentEnvironmentValidation,
  environmentExceptForProdValidation,
  environmentValidation,
  repositoryNameValidation,
  versionValidation
} from './validations'

describe('#validations', () => {
  test('Should pass with correct name', () => {
    const result = repositoryNameValidation.validate('valid-repo-name')
    expect(result.error).toBeUndefined()
  })

  test('Should error with invalid repository name', () => {
    const result = repositoryNameValidation.validate('##totally &cr*azy name!!')
    expect(result.error.message).toBe(
      'Letters and numbers with hyphen separators'
    )
  })

  test('Should error when invalid start and end characters used', () => {
    const result = repositoryNameValidation.validate('-repo-name-')
    expect(result.error.message).toBe('Start and end with a letter or number')
  })

  test('Should error when ends with "-ddl"', () => {
    const result = repositoryNameValidation.validate('incorrect-ending-ddl')
    expect(result.error.message).toBe('Must not end with "-ddl"')
  })

  test('Should error with name longer than 32 characters', () => {
    const result = repositoryNameValidation.validate(
      'invalid-repo-name-because-it-is-way-too-long'
    )
    expect(result.error.message).toBe('32 characters or less')
  })

  test('Should pass environment validation', () => {
    const result = environmentValidation.validate('test')
    expect(result.error).toBeUndefined()
  })

  test('Should error with incorrect environment name', () => {
    const result = environmentValidation.validate('invalid-env')
    expect(result.error.message).toBe(
      '"value" must be one of [management, infra-dev, dev, test, perf-test, ext-test, prod]'
    )
  })

  test('Should pass environmentExceptForProd validation', () => {
    const result = environmentExceptForProdValidation.validate('test')
    expect(result.error).toBeUndefined()
  })

  test('Should pass currentEnvironmentValidation validation', () => {
    const result = currentEnvironmentValidation.validate('local')
    expect(result.error).toBeUndefined()
  })

  test('Should pass versionValidation validation', () => {
    const result = versionValidation.validate('0.1.2')
    expect(result.error).toBeUndefined()
  })

  test('Should error with incorrect version', () => {
    const result = versionValidation.validate('0.1-beta')
    expect(result.error.message).toBe(
      '"value" with value "0.1-beta" fails to match the required pattern: /^\\d+\\.\\d+\\.\\d+$/'
    )
  })
})
