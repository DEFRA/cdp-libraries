# Hapi Connect

Hapi Connect is a Hapi plugin to mount [connect](https://github.com/senchalabs/connect#readme) based middleware at a route.

## Installing

`npm install @defra/hapi-connect`

## Usage

### Register the plugin

As part of creating the server, register the hapi-connect plugin.

```js
import connect from '@defra/hapi-connect'

await server.register({
  plugin: connect,
  options: {
    path: '/my-route',
    middleware: [myMiddleware]
  }
})
```
