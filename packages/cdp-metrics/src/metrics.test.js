import * as metricsModule from './metrics.js'

const mockHelperInstance = {
  timer: vi.fn(),
  putMetric: vi.fn(),
  flush: vi.fn()
}

vi.mock('./metrics-helper.js', async () => {
  return {
    MetricsHelper: vi.fn(() => mockHelperInstance),
    StorageResolution: {
      Standard: 60
    },
    Unit: {
      Count: 'Count',
      None: 'None',
      Bytes: 'Bytes',
      Milliseconds: 'Milliseconds'
    }
  }
})

describe('#Exported metric functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('timer records async function duration', async () => {
    const fn = vi.fn().mockResolvedValue('done')

    mockHelperInstance.timer.mockImplementationOnce(
      async (_name, fn) => await fn()
    )

    const result = await metricsModule.timer('myTimer', fn)

    expect(fn).toHaveBeenCalled()
    expect(mockHelperInstance.timer).toHaveBeenCalledWith('myTimer', fn)
    expect(mockHelperInstance.flush).toHaveBeenCalled()
    expect(result).toBe('done')
  })

  test('counter sends metric with Count unit', async () => {
    await metricsModule.counter('myCount', 5)

    expect(mockHelperInstance.putMetric).toHaveBeenCalledWith(
      'myCount',
      5,
      'Count',
      60
    )
    expect(mockHelperInstance.flush).toHaveBeenCalled()
  })

  test('gauge sends metric with None unit', async () => {
    await metricsModule.gauge('myGauge', 42)

    expect(mockHelperInstance.putMetric).toHaveBeenCalledWith(
      'myGauge',
      42,
      'None',
      60
    )
    expect(mockHelperInstance.flush).toHaveBeenCalled()
  })

  test('byteSize sends metric with Bytes unit', async () => {
    await metricsModule.byteSize('mySize', 2048)

    expect(mockHelperInstance.putMetric).toHaveBeenCalledWith(
      'mySize',
      2048,
      'Bytes',
      60
    )
    expect(mockHelperInstance.flush).toHaveBeenCalled()
  })

  test('millis sends metric with Milliseconds unit', async () => {
    await metricsModule.millis('myDuration', 300)

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
    metricsModule.setLogger({ warn: loggerSpy })

    await metricsModule.timer('failTimer', async () => {})

    expect(loggerSpy).toHaveBeenCalledWith(error)
  })
})
