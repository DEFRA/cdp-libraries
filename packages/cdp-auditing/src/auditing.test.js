import pino from 'pino'

import { audit, enableAuditing, setAuditLogger } from './auditing.js'
import { auditLoggerConfig } from './audit-logger-config.js'

export class TestPinoDestination {
  messages = []
  write(msg) {
    this.messages.push(JSON.parse(msg))
  }
  reset() {
    this.messages = []
  }
}

describe('#Auditing', () => {
  describe('audit', () => {
    const output = new TestPinoDestination()
    const testAuditLogger = pino(auditLoggerConfig, output)

    beforeEach(() => {
      setAuditLogger(testAuditLogger)
      enableAuditing()
    })

    afterEach(() => {
      output.reset()
    })

    test('Write in json with a log.level of audit and a normal string msg', () => {
      audit('This is a test of auditing')

      expect(output.messages.length).toBe(1)
      expect(output.messages[0]).toEqual({
        'log.level': 'audit',
        msg: 'This is a test of auditing',
        time: expect.any(String)
      })
    })

    test('Write in json with extra fields and message', () => {
      audit({ extra: 'data', id: 1234, ok: true }, 'This is a test of auditing')

      expect(output.messages.length).toBe(1)
      expect(output.messages[0]).toEqual({
        'log.level': 'audit',
        msg: 'This is a test of auditing',
        extra: 'data',
        id: 1234,
        ok: true,
        time: expect.any(String)
      })
    })

    test('Write structured json', () => {
      audit({ extra: 'data', id: 1234, ok: true })

      expect(output.messages[0]).toEqual({
        extra: 'data',
        id: 1234,
        'log.level': 'audit',
        ok: true,
        time: expect.any(String)
      })
    })

    test('Should not log when disabled', () => {
      enableAuditing(false)
      audit({ extra: 'data', id: 1234, ok: true })
      expect(output.messages).toEqual([])
      enableAuditing()
      audit('auditing enabled!')
      expect(output.messages).toEqual([
        {
          'log.level': 'audit',
          msg: 'auditing enabled!',
          time: expect.any(String)
        }
      ])
    })
  })
})
