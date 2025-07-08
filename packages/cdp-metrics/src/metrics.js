import { StorageResolution, Unit } from 'aws-embedded-metrics'
import { MetricsHelper } from './metrics-helper.js'

let logger

/**
 * Sets the global logger instance.
 * This should be called once by the consuming service to inject a custom logger.
 * @param {Object} newLogger - The logger object to use (e.g., console, pino, winston).
 */
export function setLogger(newLogger) {
  logger = newLogger
}

/**
 * Gets the current global logger instance.
 * @returns {Object|undefined} - Returns the current logger instance or undefined if not set.
 */
export function getLogger() {
  return logger
}

/**
 * Runs an async function while timing its duration, then flushes metrics.
 * @template T
 * @param {string} name - The name of the timer metric.
 * @param {() => Promise<T>} fn - The async function to time.
 * @param {object} [dimensions={}] - Optional dimensions to add to the metric.
 * @returns {Promise<T>} The result of the async function.
 */
export async function timer(name, fn, dimensions = {}) {
  try {
    const helper = new MetricsHelper(dimensions)
    const result = await helper.timer(name, fn)
    await helper.flush()
    return result
  } catch (e) {
    getLogger()?.warn(e)
  }
}

/**
 * Sends a count metric then flushes.
 * @param {string} name - The metric name.
 * @param {number} [value=1] - The count value.
 * @param {object} [dimensions={}] - Optional dimensions to add.
 * @returns {Promise<void>}
 */
export async function counter(name, value = 1, dimensions = {}) {
  try {
    const helper = new MetricsHelper(dimensions)
    helper.putMetric(name, value, Unit.Count, StorageResolution.Standard)
    await helper.flush()
  } catch (e) {
    getLogger()?.warn(e)
  }
}

/**
 * Sends a gauge metric (unitless) then flushes.
 * @param {string} name - The metric name.
 * @param {number} value - The gauge value.
 * @param {object} [dimensions={}] - Optional dimensions to add.
 * @returns {Promise<void>}
 */
export async function gauge(name, value, dimensions = {}) {
  try {
    const helper = new MetricsHelper(dimensions)
    helper.putMetric(name, value, Unit.None, StorageResolution.Standard)
    await helper.flush()
  } catch (e) {
    getLogger()?.warn(e)
  }
}

/**
 * Sends a size metric in bytes then flushes.
 * @param {string} name - The metric name.
 * @param {number} value - The size value in bytes.
 * @param {object} [dimensions={}] - Optional dimensions to add.
 * @returns {Promise<void>}
 */
export async function byteSize(name, value, dimensions = {}) {
  try {
    const helper = new MetricsHelper(dimensions)
    helper.putMetric(name, value, Unit.Bytes, StorageResolution.Standard)
    await helper.flush()
  } catch (e) {
    getLogger()?.warn(e)
  }
}

/**
 * Sends a timing metric in milliseconds then flushes.
 * @param {string} name - The metric name.
 * @param {number} value - The time duration in milliseconds.
 * @param {object} [dimensions={}] - Optional dimensions to add.
 * @returns {import('aws-embedded-metrics').MetricsLogger} The metrics logger.
 */
export async function millis(name, value, dimensions = {}) {
  try {
    const helper = new MetricsHelper(dimensions)
    helper.putMetric(name, value, Unit.Milliseconds, StorageResolution.Standard)
    await helper.flush()
  } catch (e) {
    getLogger()?.warn(e)
  }
}

class Metrics {
  millis = millis
  byteSize = byteSize
  gauge = gauge
  counter = counter
  timer = timer
}

export const metrics = {
  plugin: {
    name: 'metrics',
    version: '0.1.0',
    register(server, options) {
      setLogger(server.logger)
      server.decorate('request', 'metrics', () => new Metrics())
      server.decorate('server', 'metrics', () => new Metrics())
    }
  }
}
