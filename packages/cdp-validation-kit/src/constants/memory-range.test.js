import { memoryRange } from './memory-range'

describe('#memoryRange', () => {
  test('Memory range should be as expected', () => {
    expect(memoryRange(1, 2)).toEqual([
      {
        text: '1 GB',
        value: 1024
      },
      {
        text: '2 GB',
        value: 2048
      }
    ])
  })

  test('Memory range with increment should be as expected', () => {
    expect(memoryRange(16, 28, 4)).toEqual([
      {
        text: '16 GB',
        value: 16384
      },
      {
        text: '20 GB',
        value: 20480
      },
      {
        text: '24 GB',
        value: 24576
      },
      {
        text: '28 GB',
        value: 28672
      }
    ])
  })
})
