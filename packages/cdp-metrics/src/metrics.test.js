import { Metrics } from './metrics.js'

const mockHelperInstance = {
  timer: vi.fn(),
  putMetric: vi.fn(),
  flush: vi.fn()
}

vi.mock('./metrics-helper.js', () => ({
  MetricsHelper: vi.fn(function () {
    this.timer = mockHelperInstance.timer
    this.putMetric = mockHelperInstance.putMetric
    this.flush = mockHelperInstance.flush
  }),
  StorageResolution: {
    Standard: 60
  },
  Unit: {
    Count: 'Count',
    None: 'None',
    Bytes: 'Bytes',
    Milliseconds: 'Milliseconds'
  }
}))

describe('#Exported metric functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('timer records async function duration', async () => {
    const fn = vi.fn().mockResolvedValue('done')

    mockHelperInstance.timer.mockImplementationOnce(
      async (_name, fn) => await fn()
    )

    const result = await new Metrics().timer('myTimer', fn)

    expect(fn).toHaveBeenCalled()
    expect(mockHelperInstance.timer).toHaveBeenCalledWith('myTimer', fn)
    expect(mockHelperInstance.flush).toHaveBeenCalled()
    expect(result).toBe('done')
  })

  test('counter sends metric with Count unit', async () => {
    await new Metrics().counter('myCount', 5)

    expect(mockHelperInstance.putMetric).toHaveBeenCalledWith(
      'myCount',
      5,
      'Count',
      60
    )
    expect(mockHelperInstance.flush).toHaveBeenCalled()
  })

  test('gauge sends metric with None unit', async () => {
    await new Metrics().gauge('myGauge', 42)

    expect(mockHelperInstance.putMetric).toHaveBeenCalledWith(
      'myGauge',
      42,
      'None',
      60
    )
    expect(mockHelperInstance.flush).toHaveBeenCalled()
  })

  test('byteSize sends metric with Bytes unit', async () => {
    await new Metrics().byteSize('mySize', 2048)

    expect(mockHelperInstance.putMetric).toHaveBeenCalledWith(
      'mySize',
      2048,
      'Bytes',
      60
    )
    expect(mockHelperInstance.flush).toHaveBeenCalled()
  })

  test('millis sends metric with Milliseconds unit', async () => {
    await new Metrics().millis('myDuration', 300)

    expect(mockHelperInstance.putMetric).toHaveBeenCalledWith(
      'myDuration',
      300,
      'Milliseconds',
      60
    )
    expect(mockHelperInstance.flush).toHaveBeenCalled()
  })

  test('timer handles exceptions without crashing', async () => {
    const error = new Error('test failure')
    mockHelperInstance.timer.mockRejectedValueOnce(error)
    const loggerSpy = vi.fn()
    const metrics = new Metrics({ warn: loggerSpy })

    await metrics.timer('failTimer', async () => {})

    expect(loggerSpy).toHaveBeenCalledWith(error)
  })
})
