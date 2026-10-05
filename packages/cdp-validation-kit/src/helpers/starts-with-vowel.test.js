import { startsWithVowel } from './starts-with-vowel.js'
import { describe, expect, test } from 'vitest'

describe('#startsWithVowel', () => {
  test('When string starts with vowel should return true', () => {
    expect(startsWithVowel('Apple')).toBe(true)
  })

  test('When does not string starts with vowel should return false', () => {
    expect(startsWithVowel('Monkey')).toBe(false)
  })
})
