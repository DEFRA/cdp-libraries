# Hapi Auth OIDC

A Hapi.js plugin providing OpenID Connect (OIDC) authentication with PKCE support. Supports federated Cognito tokens, mock tokens for testing, and automatic token validation and refresh. Designed for server-side Hapi applications.

## Features

- Pre-login redirect to OIDC provider with PKCE support
- Post-login handling with token validation
- Automatic access token refresh with configurable early refresh window
- Federated token support via Cognito Identity Pools
- Optional request decoration to validate and refresh tokens
- Mock OIDC provider for development and testing environments
- Fully configurable cookie options

## Installation

```bash
npm install @defra/hapi-auth-oidc
```

## Usage

### Importing from the library

All public functions, providers, and plugins are exported from the library entry point:

```js
import {
  HapiAuthOidcPlugin,
  CognitoTokenProvider,
  MockProvider,
  preLogin,
  postLogin,
  validateAndRefreshToken
} from '@defra/hapi-auth-oidc'
```

Alternatively, import the entire library as a namespace:

```js
import * as OIDC from '@defra/hapi-auth-oidc'
const plugin = OIDC.HapiAuthOidcPlugin
const tokenProvider = new OIDC.CognitoTokenProvider({...})
```

### Registering the plugin

```js
import Hapi from '@hapi/hapi'
import { AuthOidcPlugin } from './auth-oidc.js'

const server = Hapi.server({ port: 3000 })

await server.register(AuthOidcPlugin)
server.auth.strategy('azure-oidc', 'hapi-auth-oidc')
```

### Decorating requests

If `enableRefreshDecoration` is true (default), requests are decorated with `validateAndRefreshToken`:

```js
server.route({
  method: 'GET',
  path: '/protected',
  handler: async (request, h) => {
    const token = await request.validateAndRefreshToken({
      accessToken: request.auth.credentials.accessToken,
      refreshToken: request.auth.credentials.refreshToken
    })
    return { token }
  },
  options: {
    auth: 'azure-oidc'
  }
})
```

### Token refresh

Standalone usage:

```js
import { validateAndRefreshToken } from '@defra/hapi-auth-oidc'

const refreshedToken = await validateAndRefreshToken(
  { accessToken, refreshToken },
  getOidcConfig,
  60000,
  oidcScope,
  logger
)
```

## Configuration

### Plugin options

- `strategyName` - Name of the Hapi auth strategy (default: `'hapi-auth-oidc'`)
- `oidc` - OIDC configuration object:
  - `clientId` - OIDC client ID
  - `discoveryUri` - URL for OIDC discovery document
  - `authProvider` - Token provider (`CognitoTokenProvider` or `MockProvider`)
  - `useHttp` - Boolean flag to allow insecure HTTP requests for discovery (default: false)
  - `loginCallbackUri` - Redirect URI after OIDC login
  - `scope` - Space-separated string of scopes
  - `externalBaseUrl` - Base URL used to construct absolute callback URLs
  - `defaultPostLoginUri` - Redirect URI after login if not otherwise specified (default: `'/'`)
  - `enableRefreshDecoration` - Whether to decorate requests with `validateAndRefreshToken` (default: true)
  - `earlyRefreshMs` - Milliseconds before token expiry to refresh early (default: 60000)

- `cookieOptions` - Cookie options for Iron encryption and security
  - `password` - Secret used for Iron encryption (required)
  - `isSecure` - Send cookie over HTTPS only (default: true)
  - `encoding` - `'none' | 'base64' | 'base64json' | 'iron'` (default: `'iron'`)
  - `path` - Cookie path (default: `'/'`)
  - `isHttpOnly` - Cookie inaccessible to client-side JS (default: true)
  - `isSameSite` - `'Strict' | 'Lax' | 'None'` (default: `'Lax'`)
  - `ttl` - Time-to-live in milliseconds (optional)
  - `domain` - Cookie domain (optional)
  - `ignoreErrors` - Ignore encoding errors (default: true)
  - `clearInvalid` - Automatically clear invalid cookies (default: true)

## Token Providers

### CognitoTokenProvider

- Federated token provider for AWS Cognito Identity Pools.
- Automatically caches the token and refreshes it before expiry.
- Supports optional early refresh via `earlyRefreshMs`.

### MockProvider

- Simple mock token provider for development/testing.
- Returns a hardcoded token.

## Example Usage

```js
import { config } from '../../../../config/config.js'
import {
  CognitoTokenProvider,
  HapiAuthOidcPlugin,
  MockProvider
} from '../hapi-auth-oidc/index.js'
import * as openid from 'openid-client'

const authProvider = config.get('isProduction')
  ? new CognitoTokenProvider({
      poolId: config.get('azureFederatedCredentials.identityPoolId'),
      logins: { 'cdp-portal-frontend-aad-access': 'cdp-portal-frontend' }
    })
  : new MockProvider()

const oidcCookieConfig = config.get('hapi-auth-oidc.cookie')

export const AuthOidcPlugin = {
  plugin: HapiAuthOidcPlugin,
  options: {
    strategyName: 'azure-oidc',
    oidc: {
      clientId: config.get('azureClientId'),
      discoveryUri: config.get('oidcWellKnownConfigurationUrl'),
      authProvider,
      useHttp: config.get('auth.Mock'),
      loginCallbackUri: config.get('appBaseUrl') + '/auth/callback',
      scope: `api://${config.get('azureClientId')}/cdp.user openid profile email offline_access user.read`,
      externalBaseUrl: config.get('appBaseUrl')
    },
    cookieOptions: {
      isSecure: oidcCookieConfig.isSecure,
      password: oidcCookieConfig.password
    }
  }
}
```
