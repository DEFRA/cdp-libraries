import {
  createMetricsLogger,
  StorageResolution,
  Unit
} from 'aws-embedded-metrics'
import { getLogger } from './metrics.js'

/**
 * Helper class to manage AWS Embedded Metrics logging, timers, and counters.
 */
export class MetricsHelper {
  /**
   * Creates a MetricsHelper instance.
   * @param {Record<string, string>} [dimensions={}] - Default dimensions to set on the metrics logger.
   */
  constructor(dimensions = {}) {
    /** @type {Record<string, number>} */
    this.timers = {}

    /** @type {import('aws-embedded-metrics').MetricsLogger} */
    this.metricsLogger = createMetricsLogger()
    this.metricsLogger.setDimensions(dimensions)
  }

  /**
   * Starts a timer with the given name.
   * @param {string} name - The name of the timer.
   * @returns {void}
   */
  startTimer(name) {
    this.timers[name] = Date.now()
  }

  /**
   * Ends a timer with the given name and records the duration metric.
   * @param {string} name - The name of the timer.
   * @throws {Error} If the timer was not started.
   * @returns {import('aws-embedded-metrics').MetricsLogger} The metrics logger.
   */
  endTimer(name) {
    const start = this.timers[name]
    if (start == null) {
      getLogger()?.error(`Timer "${name}" was not started.`)
      throw new Error(`Timer "${name}" was not started.`)
    }

    try {
      const durationMs = Date.now() - start
      const metricsLogger = this.putMetric(
        name,
        durationMs,
        Unit.Milliseconds,
        StorageResolution.Standard
      )
      delete this.timers[name]
      return metricsLogger
    } catch (e) {
      getLogger()?.warn(e)
    }
  }

  /**
   * Runs an async function while timing its duration, and records it as a metric.
   * @template T
   * @param {string} name - The metric name for the timer.
   * @param {() => Promise<T>} fn - The async function to time.
   * @returns {Promise<T>} The result of the async function.
   */
  async timer(name, fn) {
    this.startTimer(name)
    try {
      return await fn()
    } finally {
      this.endTimer(name)
    }
  }

  /**
   * Gets the underlying metrics logger instance.
   * @returns {import('aws-embedded-metrics').MetricsLogger} The metrics logger.
   */
  getMetricsLogger() {
    return this.metricsLogger
  }

  /**
   * Puts a single metric.
   * @param {string} name - The metric name.
   * @param {number} value - The metric value.
   * @param {import('aws-embedded-metrics').Unit} unit - The metric unit (e.g. Count, Milliseconds).
   * @param {import('aws-embedded-metrics').StorageResolution} [resolution] - Optional resolution (e.g. Standard).
   * @returns {import('aws-embedded-metrics').MetricsLogger} The metrics logger.
   */
  putMetric(name, value, unit, resolution) {
    return this.metricsLogger.putMetric(name, value, unit, resolution)
  }

  /**
   * Flushes any buffered metrics to CloudWatch.
   * @returns {Promise<void>}
   */
  async flush() {
    await this.metricsLogger.flush()
  }
}
