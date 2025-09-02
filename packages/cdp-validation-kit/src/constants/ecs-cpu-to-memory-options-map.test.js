import { ecsCpuToMemoryOptionsMap } from './ecs-cpu-to-memory-options-map'

describe('ecsCpuToMemoryMap', () => {
  test('Cpu of 8192 should only allows memory in increments of 4gb', () => {
    expect(ecsCpuToMemoryOptionsMap['8192']).toEqual([
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
      },
      {
        text: '32 GB',
        value: 32768
      },
      {
        text: '36 GB',
        value: 36864
      },
      {
        text: '40 GB',
        value: 40960
      },
      {
        text: '44 GB',
        value: 45056
      },
      {
        text: '48 GB',
        value: 49152
      },
      {
        text: '52 GB',
        value: 53248
      },
      {
        text: '56 GB',
        value: 57344
      },
      {
        text: '60 GB',
        value: 61440
      }
    ])
  })

  test('Cpu values should match those supported by ECS fargate', () => {
    expect(
      Object.keys(ecsCpuToMemoryOptionsMap).map((key) => parseInt(key))
    ).toEqual([512, 1024, 2048, 4096, 8192])
  })
})
