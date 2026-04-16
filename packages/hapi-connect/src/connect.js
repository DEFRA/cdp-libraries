import { notFound } from '@hapi/boom'
import { finished } from 'node:stream/promises'
import connect from 'connect'

export default {
  name: 'connect',
  version: '0.1.0',
  description: 'Mount `connect` based middleware at a route',
  register: async function (server, options) {
    const { path, middleware } = options

    const app = connect()

    server.route({
      method: '*',
      path: `${path}/{param*}`,
      handler: async (request, h) => {
        for (const item of middleware) {
          app.use(path, item)
        }

        const { req, res } = request.raw

        const { promise: next, resolve: resolveNext } = Promise.withResolvers()
        app(req, res, () => resolveNext(true))

        const nextCalled = await Promise.race([finished(res), next])

        if (nextCalled) {
          return notFound()
        }

        return h.abandon
      }
    })
  }
}
