import { StorageResolution, Unit } from 'aws-embedded-metrics'
import { MetricsHelper } from './metrics-helper.js'

export class Metrics {
  constructor(logger) {
    this.logger = logger
  }

  /**
   * Runs an async function while timing its duration, then flushes metrics.
   * @template T
   * @param {string} name - The name of the timer metric.
   * @param {() => Promise<T>} fn - The async function to time.
   * @param {object} [dimensions={}] - Optional dimensions to add to the metric.
   * @returns {Promise<T>} The result of the async function.
   */
  async timer(name, fn, dimensions = {}) {
    try {
      const helper = new MetricsHelper(dimensions, this.logger)
      const result = await helper.timer(name, fn)
      await helper.flush()
      return result
    } catch (e) {
      this.logger?.warn?.(e)
    }
  }

  /**
   * Sends a count metric then flushes.
   * @param {string} name - The metric name.
   * @param {number} [value=1] - The count value.
   * @param {object} [dimensions={}] - Optional dimensions to add.
   * @returns {Promise<void>}
   */
  async counter(name, value = 1, dimensions = {}) {
    try {
      const helper = new MetricsHelper(dimensions, this.logger)
      helper.putMetric(name, value, Unit.Count, StorageResolution.Standard)
      await helper.flush()
    } catch (e) {
      this.logger?.warn?.(e)
    }
  }

  /**
   * Sends a gauge metric (unitless) then flushes.
   * @param {string} name - The metric name.
   * @param {number} value - The gauge value.
   * @param {object} [dimensions={}] - Optional dimensions to add.
   * @returns {Promise<void>}
   */
  async gauge(name, value, dimensions = {}) {
    try {
      const helper = new MetricsHelper(dimensions, this.logger)
      helper.putMetric(name, value, Unit.None, StorageResolution.Standard)
      await helper.flush()
    } catch (e) {
      this.logger?.warn?.(e)
    }
  }

  /**
   * Sends a size metric in bytes then flushes.
   * @param {string} name - The metric name.
   * @param {number} value - The size value in bytes.
   * @param {object} [dimensions={}] - Optional dimensions to add.
   * @returns {Promise<void>}
   */
  async byteSize(name, value, dimensions = {}) {
    try {
      const helper = new MetricsHelper(dimensions, this.logger)
      helper.putMetric(name, value, Unit.Bytes, StorageResolution.Standard)
      await helper.flush()
    } catch (e) {
      this.logger?.warn?.(e)
    }
  }

  /**
   * Sends a timing metric in milliseconds then flushes.
   * @param {string} name - The metric name.
   * @param {number} value - The time duration in milliseconds.
   * @param {object} [dimensions={}] - Optional dimensions to add.
   * @returns {import('aws-embedded-metrics').MetricsLogger} The metrics logger.
   */
  async millis(name, value, dimensions = {}) {
    try {
      const helper = new MetricsHelper(dimensions, this.logger)
      helper.putMetric(
        name,
        value,
        Unit.Milliseconds,
        StorageResolution.Standard
      )
      await helper.flush()
    } catch (e) {
      this.logger?.warn?.(e)
    }
  }

  /**
   * Creates and returns an AWS Embedded Metrics logger instance with optional dimensions.
   *
   * This function initializes a new {@link MetricsHelper} internally and returns its
   * `MetricsLogger`. The logger can then be used to emit custom CloudWatch metrics.
   *
   * @function getMetricsLogger
   * @param {object} [dimensions={}] - Optional key/value pairs representing metric dimensions.
   *                                   These dimensions will be applied to all metrics logged
   *                                   with the returned logger.
   *
   * @returns {import('aws-embedded-metrics').MetricsLogger}
   *          A configured AWS Embedded Metrics logger.
   *
   * @example
   * // Create a metrics logger with a service dimension
   * const logger = getMetricsLogger({ Service: 'Uploader' })
   * logger.putMetric('FilesUploaded', 1, Unit.Count)
   * await logger.flush()
   */
  getMetricsLogger(dimensions = {}) {
    const helper = new MetricsHelper(dimensions, this.logger)
    return helper.getMetricsLogger()
  }

  /**
   * Logs a single custom metric to AWS CloudWatch using Embedded Metrics.
   *
   * This function initializes a new {@link MetricsHelper} internally and emits a single
   * metric with the provided name, value, and unit.
   *
   * **Note: ** This function does not automatically flush the metrics.
   * Ensure you call `logger.flush()` if you need metrics to appear in CloudWatch promptly.
   *
   * @function putMetrics
   * @param {string} name - The name of the metric (e.g., "FilesUploaded").
   * @param {number} value - The value to record for the metric.
   * @param {import('aws-embedded-metrics').Unit} unit - The unit of the metric (e.g., `Unit.Count`, `Unit.Milliseconds`).
   * @param {import('aws-embedded-metrics').StorageResolution} [resolution] -
   *        Optional storage resolution (e.g., `StorageResolution.Standard` or `StorageResolution.High`).
   * @param {object} [dimensions={}] - Optional key/value pairs representing metric dimensions.
   *
   * @returns {import('aws-embedded-metrics').MetricsLogger}
   *          The metrics logger instance used to emit the metric.
   *
   * @example
   * // Emit a metric with default dimensions
   * putMetrics('ProcessingTime', 125, Unit.Milliseconds, StorageResolution.High)
   */
  putMetrics(name, value, unit, resolution, dimensions = {}) {
    const helper = new MetricsHelper(dimensions, this.logger)
    return helper.putMetric(name, value, unit, resolution)
  }
}

export const metrics = {
  plugin: {
    name: 'metrics',
    version: '0.2.0',
    register(server) {
      server.decorate('request', 'metrics', function () {
        const logger = server.logger
        return new Metrics(logger)
      })

      server.decorate('server', 'metrics', function () {
        // this is intentional as destructuring can lead to 'this' missing
        const logger = server.logger
        return new Metrics(logger)
      })
    }
  }
}
