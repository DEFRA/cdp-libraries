import { MetricsHelper } from './metrics-helper.js'

// Mock the entire aws-embedded-metrics module
const mockPutMetric = vi.fn()
const mockFlush = vi.fn()
const mockSetDimensions = vi.fn()

vi.mock('aws-embedded-metrics', () => {
  return {
    createMetricsLogger: vi.fn(() => ({
      putMetric: mockPutMetric,
      flush: mockFlush,
      setDimensions: mockSetDimensions
    })),
    Unit: {
      Milliseconds: 'Milliseconds',
      Count: 'Count'
    },
    StorageResolution: {
      Standard: 'Standard',
      High: 'High'
    }
  }
})

describe('MetricsHelper', () => {
  beforeEach(() => {
    mockPutMetric.mockClear()
    mockFlush.mockClear()
    mockSetDimensions.mockClear()
  })

  test('constructor sets dimensions via metricsLogger.setDimensions', () => {
    const dims = { service: 'test' }
    const helper = new MetricsHelper(dims)
    expect(mockSetDimensions).toHaveBeenCalledWith(dims)
    expect(helper.timers).toEqual({})
  })

  test('startTimer stores start time', () => {
    const helper = new MetricsHelper()
    vi.useFakeTimers()
    vi.setSystemTime(1234567890)
    helper.startTimer('myTimer')
    expect(helper.timers.myTimer).toBe(1234567890)
    vi.useRealTimers()
  })

  test('endTimer records metric and deletes timer', () => {
    const helper = new MetricsHelper()
    vi.useFakeTimers()
    vi.setSystemTime(1000)
    helper.startTimer('myTimer')
    vi.setSystemTime(1500)
    helper.endTimer('myTimer')

    expect(mockPutMetric).toHaveBeenCalledWith(
      'myTimer',
      500,
      'Milliseconds',
      'Standard'
    )
    expect(helper.timers.myTimer).toBeUndefined()
    vi.useRealTimers()
  })

  test('endTimer throws if timer was not started', () => {
    const helper = new MetricsHelper()
    expect(() => helper.endTimer('noTimer')).toThrow(
      'Timer "noTimer" was not started.'
    )
  })

  test('timer async method calls function and records duration', async () => {
    const helper = new MetricsHelper()
    const fn = vi.fn().mockResolvedValue('result')

    vi.useFakeTimers()
    vi.setSystemTime(1000)

    const promise = helper.timer('asyncTimer', fn)

    vi.setSystemTime(1300)
    const result = await promise

    expect(result).toBe('result')
    expect(fn).toHaveBeenCalled()
    expect(mockPutMetric).toHaveBeenCalledWith(
      'asyncTimer',
      300,
      'Milliseconds',
      'Standard'
    )
    vi.useRealTimers()
  })

  test('getMetricsLogger returns the logger instance', () => {
    const helper = new MetricsHelper()
    expect(helper.getMetricsLogger()).toHaveProperty('putMetric')
  })

  test('putMetric calls underlying logger.putMetric', () => {
    const helper = new MetricsHelper()
    helper.putMetric('metric', 42, 'Count')
    expect(mockPutMetric).toHaveBeenCalledWith('metric', 42, 'Count', undefined)
  })

  test('putMetric uses custom resolution if provided', () => {
    const helper = new MetricsHelper()
    helper.putMetric('metric', 10, 'Count', 'High')
    expect(mockPutMetric).toHaveBeenCalledWith('metric', 10, 'Count', 'High')
  })

  test('flush calls logger.flush', async () => {
    const helper = new MetricsHelper()
    await helper.flush()
    expect(mockFlush).toHaveBeenCalled()
  })
})
