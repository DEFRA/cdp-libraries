import { describe, test, expect, afterEach, beforeEach } from 'vitest'
import { Server } from '@hapi/hapi'

import { tracing, withTraceId } from './tracing.js'

describe('#tracing and #withTraceId', () => {
  const mockTraceId = 'mock-trace-id-123'
  let server

  beforeEach(async () => {
    server = new Server()

    await server.register({
      plugin: tracing.plugin,
      options: { tracingHeader: 'x-cdp-request-id' }
    })
  })

  afterEach(async () => {
    await server.stop({ timeout: 0 })
  })

  describe('#tracing', () => {
    test('Should register the plugin', () => {
      expect(server.registrations).toEqual({
        tracing: {
          name: 'tracing',
          options: { tracingHeader: 'x-cdp-request-id' },
          version: '0.1.0'
        }
      })
    })

    test('Should have expected decorations', () => {
      expect(server.decorations.request).toStrictEqual(['getTraceId'])
      expect(server.decorations.server).toStrictEqual(['getTraceId'])
    })

    test('Should add "x-cdp-request-id" to the request store', async () => {
      expect.assertions(3)

      server.route({
        method: 'GET',
        path: '/testing',
        handler: (request, h) => {
          expect(request.getTraceId()).toBe(mockTraceId)

          return h.response({ message: 'success' }).code(200)
        }
      })

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/testing',
        headers: { 'x-cdp-request-id': mockTraceId }
      })

      expect(result).toEqual({ message: 'success' })
      expect(statusCode).toBe(200)
    })

    describe('Without "x-cdp-request-id" header', () => {
      test('"x-cdp-request-id" should not be in the request store', async () => {
        expect.assertions(3)

        server.route({
          method: 'GET',
          path: '/testing-no-tracing-header',
          handler: (request, h) => {
            expect(request.getTraceId()).toBeUndefined()

            return h.response({ message: 'success' }).code(200)
          }
        })

        const { result, statusCode } = await server.inject({
          method: 'GET',
          url: '/testing-no-tracing-header'
        })

        expect(result).toEqual({ message: 'success' })
        expect(statusCode).toBe(200)
      })
    })

    describe('When tracing is disabled', () => {
      let server

      beforeEach(async () => {
        server = new Server()

        await server.register({
          plugin: tracing.plugin,
          options: { tracingHeader: false }
        })
      })

      afterEach(async () => {
        await server.stop({ timeout: 0 })
      })

      test('Should have registered the plugin', () => {
        expect(server.registrations).toEqual({
          tracing: {
            name: 'tracing',
            options: { tracingHeader: false },
            version: '0.1.0'
          }
        })
      })

      test('Should have expected decorations', () => {
        expect(server.decorations.request).toStrictEqual(['getTraceId'])
        expect(server.decorations.server).toStrictEqual(['getTraceId'])
      })

      test('Should not add "x-cdp-request-id" to the request store', async () => {
        expect.assertions(3)

        server.route({
          method: 'GET',
          path: '/different-url',
          handler: (request, h) => {
            expect(request.getTraceId()).toBeUndefined()

            return h.response({ message: 'success' }).code(200)
          }
        })

        const { result, statusCode } = await server.inject({
          method: 'GET',
          url: '/different-url',
          headers: { 'x-cdp-request-id': mockTraceId }
        })

        expect(result).toEqual({ message: 'success' })
        expect(statusCode).toBe(200)
      })
    })
  })

  describe('#withTraceId', () => {
    test('Should add traceId to headers when traceId exists', async () => {
      expect.assertions(3)

      const mockHeaders = {
        existingHeader: 'value',
        'x-cdp-request-id': mockTraceId
      }

      server.route({
        method: 'GET',
        path: '/testing-with-trace-id',
        handler: (request, h) => {
          const result = withTraceId('x-trace-id', mockHeaders)
          expect(result).toEqual({
            existingHeader: 'value',
            'x-cdp-request-id': 'mock-trace-id-123',
            'x-trace-id': 'mock-trace-id-123'
          })

          return h.response({ message: 'success' }).code(200)
        }
      })

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/testing-with-trace-id',
        headers: mockHeaders
      })

      expect(result).toEqual({ message: 'success' })
      expect(statusCode).toBe(200)
    })

    test('Should not modify headers when traceId does not exist', async () => {
      expect.assertions(3)

      const mockHeaders = {
        existingHeader: 'value'
      }

      server.route({
        method: 'GET',
        path: '/testing-with-trace-id',
        handler: (request, h) => {
          const result = withTraceId('x-trace-id', mockHeaders)
          expect(result).toEqual({
            existingHeader: 'value'
          })

          return h.response({ message: 'success' }).code(200)
        }
      })

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/testing-with-trace-id',
        headers: mockHeaders
      })

      expect(result).toEqual({ message: 'success' })
      expect(statusCode).toBe(200)
    })

    test('Should return a new headers object when no headers are provided', async () => {
      expect.assertions(3)

      server.route({
        method: 'GET',
        path: '/testing-with-trace-id',
        handler: (request, h) => {
          const result = withTraceId('x-trace-id')
          expect(result).toEqual({})

          return h.response({ message: 'success' }).code(200)
        }
      })

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/testing-with-trace-id'
      })

      expect(result).toEqual({ message: 'success' })
      expect(statusCode).toBe(200)
    })
  })
})
