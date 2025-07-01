# Hapi Secure Context

A plugin that installs

## Installing

`npm install @defra/hapi-tracing`

## Usage

The library consists of two parts:

1. The Hapi Plugin
2. The `getTraceId()` and `withTraceId` helpers

### Register the plugin

As part of creating the server, register the hapi-tracing plugin.

```js
import { tracing } from '@defra/hapi-tracing'

await server.register({
  plugin: tracing.plugin,
  options: { tracingHeader: 'x-your-trace-id' }
})
```

Once registered you will be able to call `getTraceId()` inside your controllers to return the value of the header if it
has been passed in.

For example:

```js
import { getTraceId } from '@defra/hapi-tracing'

const healthController = {
  handler: (request, h) => {
    return h.response({ message: `trace-id is ${getTraceId()}` }).code(200)
  }
}
```

The calls to `getTraceId()` don't have to originate from the controller. Any function called from the controller,
directly or indirectly can use it.

```js
import { getTraceId } from '@defra/hapi-tracing'

const healthController = {
  handler: (request, h) => {
    doSomething()
    return h.response().code(200)
  }
}

const doSomething = () => {
  doSomethingElse()
}

const doSomethingElse = () => {
  console.log(`trace-id is still ${getTraceId()}`)
}
```

## Common Use-Cases

### Propagating headers.

In order to track a request across multiple services you will need to forward the trace-id header on to other calls made
as part of the request.

For this example we will be using node:fetch. Different HTTP clients may have different API's for settings headers but
the concept should be the same.

The `hapi-tracing` package include a `withTraceId` helper that takes the name of the tracing header and an object
containing the existing headers.
If the traceId has been set it returns the original header object with the traceId header and value added. If the
traceId is not set then the original header object is return unmodified.

```js
import { withTraceId } from '@defra/hapi-tracing'

async function getSomething() {
  return await fetch('http://localhost:8080/test', {
    method: 'get',
    headers: withTraceId('x-your-trace-id', {
      'Content-Type': 'application/json',
      'x-some-other-header': '1234'
    })
  })
}
```

### Logging the header

Some loggers will automatically include the original HTTP request which will include tracing header as well as any other
headers that are not redacted.
For this example we will use Pino with the ECS formatter as our logger.

```js
export const loggerOptions = {
  enabled: logConfig.enabled,
  level: 'info', // other setup
  nesting: true,
  mixin: () => {
    const mixinValues = {}
    const traceId = getTraceId()

    if (traceId) {
      mixinValues.trace = { id: traceId }
    }
    return mixinValues
  }
}

// elsewhere
const logger = pino(loggerOptions)
```

This will set the traceId to appear in the `trace.id` field in the structure logs.

## Jest Transform Ignore Patterns

Jest automatically transpiles all code it uses in its tests. This can cause issues when a dependency only supports ESM
modules, and you use it in your tests. If this is the case you may need to add the following to your Jest configuration
to prevent Jest transpiling the module with Babel in your tests.
For more detailed information have a read of https://jestjs.io/docs/configuration#transformignorepatterns-arraystring

> [!TIP]
> If you need to add this configuration, typically you will see the error
> `SyntaxError: Cannot use import statement outside a module` when running Jest tests.

Add the following to your Jest configuration in `jest.config.js`:

```js
transformIgnorePatterns: [
  `node_modules/(?!${[
    '@defra/hapi-tracing', // Dependency supports ESM only so we do not wish to transpile it in our tests. It's already ready to go
    'node-fetch' // v3 of Node-fetch supports ESM only so we do not wish to transpile it in our tests. It's already ready to go
  ].join('|')}/)`
]
```
