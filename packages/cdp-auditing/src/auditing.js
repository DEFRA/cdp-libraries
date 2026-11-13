import pino from 'pino'
import { auditLoggerConfig } from './audit-logger-config.js'

let auditLogger = pino(auditLoggerConfig)

if (process.env.CDP_AUDIT_ENABLED === 'false') {
  enableAuditing(false)
}

/**
 * Replaces the current audit logger.
 *
 * @param {Logger} logger
 */
export function setAuditLogger(logger) {
  auditLogger = logger
}

/**
 * Writes audit messages to the given destination, keeping the current enabled state.
 * Pass the destination your service loggers use, so their output can't interleave.
 *
 * @param {DestinationStream} destination
 */
export function setAuditDestination(destination) {
  const level = auditLogger.level
  auditLogger = pino(auditLoggerConfig, destination)
  auditLogger.level = level
}

/**
 * Globally enables or disables auditing
 * @param {boolean|null} isEnabled
 */
export function enableAuditing(isEnabled = true) {
  if (isEnabled) {
    auditLogger.level = 'audit'
  } else {
    auditLogger.level = 'silent'
  }
}

/**
 * Writes an audit message to stdout with a `log.level` of `audit`.
 * API is exactly the same as pino's logger api.
 *
 * @param { ...Object|String|Error } args - Either:
 *   - one String
 *   - one Object or Error
 *   - one Object or Error and one String
 */
export function audit(...args) {
  auditLogger.audit.apply(auditLogger, args)
}
