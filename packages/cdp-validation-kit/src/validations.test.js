import { describe, test, expect } from 'vitest'
import {
  currentEnvironmentValidation,
  environmentExceptForProdValidation,
  environmentValidation,
  repositoryNameValidation
} from './validations'

describe('validations', () => {
  test('validate repository name validation', () => {
    const result = repositoryNameValidation.validate('valid-repo-name')
    expect(result.error).toBeUndefined()
  })

  test('invalid repository name validation with name longer than 32 characters', () => {
    const result = repositoryNameValidation.validate(
      'invalid-repo-name-because-it-is-way-too-long'
    )
    expect(result.error.message).toBe('32 characters or less')
  })

  test('validate environment validation', () => {
    const result = environmentValidation.validate('test')
    expect(result.error).toBeUndefined()
  })

  test('invalid environment validation with incorrect environment name', () => {
    const result = environmentValidation.validate('invalid-env')
    expect(result.error.message).toBe(
      '"value" must be one of [management, infra-dev, dev, test, perf-test, ext-test, prod]'
    )
  })

  test('validate environmentExceptForProd validation', () => {
    const result = environmentExceptForProdValidation.validate('test')
    expect(result.error).toBeUndefined()
  })

  test('invalid environmentExceptForProd validation with incorrect environment name', () => {
    const result = environmentExceptForProdValidation.validate('prod')
    expect(result.error.message).toBe(
      '"value" must be one of [infra-dev, management, dev, test, perf-test, ext-test]'
    )
  })

  test('validate currentEnvironmentValidation validation', () => {
    const result = currentEnvironmentValidation.validate('local')
    expect(result.error).toBeUndefined()
  })

  test('invalid currentEnvironmentValidation validation with incorrect environment name', () => {
    const result = currentEnvironmentValidation.validate('something-else')
    expect(result.error.message).toBe(
      '"value" must be one of [local, management, infra-dev, dev, test, perf-test, ext-test, prod]'
    )
  })
})
