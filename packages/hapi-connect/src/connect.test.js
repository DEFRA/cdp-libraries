import { Server } from '@hapi/hapi'
import connect from './connect.js'

describe('hapi-connect', () => {
  let server

  function mockMiddleware(req, res, next) {
    if (req.url === '/') return res.end('Success')
    next()
  }

  beforeEach(async () => {
    server = new Server()

    await server.register({
      plugin: connect,
      options: { path: '/test', middleware: [mockMiddleware] }
    })
  })

  afterEach(async () => {
    await server.stop({ timeout: 0 })
  })

  it('does NOT handle a non-matching route', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(statusCode).toBe(404)
  })

  it('handles a middleware response', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/test'
    })

    expect(result).toEqual('Success')
    expect(statusCode).toBe(200)
  })

  it('handles a middleware fall-through', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/test/not-handled'
    })

    expect(statusCode).toBe(404)
  })
})
