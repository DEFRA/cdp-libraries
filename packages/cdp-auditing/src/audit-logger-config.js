import pino from 'pino'

export const auditLoggerConfig = {
  level: 'audit',
  customLevels: { audit: 999 },
  useOnlyCustomLevels: true,
  timestamp: pino.stdTimeFunctions.isoTime,
  base: null,
  formatters: {
    level(label) {
      return { 'log.level': label.toLowerCase() }
    }
  }
}
