# Hapi SecureContext

A plugin to load custom CA certs into node's tls.secureContext.

## Installing

`npm install @defra/hapi-secure-context`

## Usage

The plugin will load custom certificates from environment variable.
This is controlled via the plugin's options during registration.

### Register the plugin

This should be done when creating the server.

```js
import { secureContext } from '@defra/hapi-secure-context'

await server.register({
  plugin: secureContext.plugin,
  options: {}
})
```

By default, the plugin will attempt to load certificates from any environment variable starting with `TRUSTSTORE_`.

### Options

The plugin suports the following options:

- keys
- prefix

#### Keys

Setting `keys` restricts the plugin to only load certificates from environment variables in the list.
The environment variables must contain a base64 encoded certificate.

```js
await server.register({
  plugin: secureContext.plugin,
  options: { keys: ['CERT_1', 'CERT_2'] }
})
```

#### Prefix

Setting `prefix` overrides the default prefix.

```js
await server.register({
  plugin: secureContext.plugin,
  options: { prefix: 'MY_CUSTOM_PREFIX_' }
})
```

In the above example it will attempt to load any environment variable that begins with `MY_CUSTOM_PREFIX_`.

## Usage

After registering, any certificate will be added to the default secureContext.
Libraries that use the default node tls.secureContext will pick up these certs automatically.

The plugin will decorate the `server` object with an instance of secureContext, e.g. `server.secureContext`.

If you want to load the custom certificates manually, the plugin also decorates the `server` object with a `customCACerts` field.
This contains an
