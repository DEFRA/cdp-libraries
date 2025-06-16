import { describe, it, expect } from 'vitest'
import {
  currentEnvironmentValidation,
  environmentExceptForProdValidation,
  environmentValidation,
  repositoryNameValidation
} from './validations'

describe('validations', () => {
  it('validate repository name validation', () => {
    const result = repositoryNameValidation.validate('valid-repo-name')
    expect(result.error).toBeUndefined()
  })

  it('invalid repository name validation with name longer than 32 characters', () => {
    const result = repositoryNameValidation.validate(
      'invalid-repo-name-because-it-is-way-too-long'
    )
    expect(result.error.message).toBe('32 characters or less')
  })

  it('validate environment validation', () => {
    const result = environmentValidation.validate('test')
    expect(result.error).toBeUndefined()
  })

  it('invalid environment validation with incorrect environment name', () => {
    const result = environmentValidation.validate('invalid-env')
    expect(result.error.message).toBe(
      '"value" must be one of [management, infra-dev, dev, test, perf-test, ext-test, prod]'
    )
  })

  it('validate environmentExceptForProd validation', () => {
    const result = environmentExceptForProdValidation.validate('test')
    expect(result.error).toBeUndefined()
  })

  it('invalid environmentExceptForProd validation with incorrect environment name', () => {
    const result = environmentExceptForProdValidation.validate('prod')
    expect(result.error.message).toBe(
      '"value" must be one of [infra-dev, management, dev, test, perf-test, ext-test]'
    )
  })

  it('validate currentEnvironmentValidation validation', () => {
    const result = currentEnvironmentValidation.validate('local')
    expect(result.error).toBeUndefined()
  })

  it('invalid currentEnvironmentValidation validation with incorrect environment name', () => {
    const result = currentEnvironmentValidation.validate('something-else')
    expect(result.error.message).toBe(
      '"value" must be one of [local, management, infra-dev, dev, test, perf-test, ext-test, prod]'
    )
  })
})
