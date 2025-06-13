import { describe, it, expect } from 'vitest'
import { repositoryNameValidation } from './validations'

describe('validations', () => {
  it('validate repository name validation', () => {
    const result = repositoryNameValidation.validate('valid-repo-name')
    expect(result.error).toBeUndefined()
  })

  it('invalid repository name validation with name longer than 32 characters', () => {
    const result = repositoryNameValidation.validate(
      'invalid-repo-name-because-it-is-way-too-long-yes-please'
    )
    expect(result.error.message).toBe('32 characters or less')
  })
})
