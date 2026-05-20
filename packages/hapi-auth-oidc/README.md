# Hapi Auth OIDC

A Hapi.js plugin providing OpenID Connect (OIDC) authentication with PKCE support. Supports federated Cognito tokens, mock tokens for testing, and automatic token validation and refresh. Designed for server-side Hapi applications.

## Features

- login redirect to OIDC provider with PKCE support
- Auth callback handling with token validation
- Automatic access token refresh with configurable early refresh window
- Federated token support via Cognito Identity Pools
- request decoration ensureValidToken, login and handle callbacks
- Mock OIDC provider for development and testing environments
- form_post and query auth callback support
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
  ensureValidToken
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
```

### Decorating requests

```js
server.route({
  method: 'GET',
  path: '/protected',
  handler: async (request, h) => {
    const { token, refreshed } = await request.ensureValidToken(
      request.auth.credentials
    )
    return { token }
  }
})
```

### Token refresh

Standalone usage:

```js
import { ensureValidToken } from '@defra/hapi-auth-oidc'

const refreshedToken = await ensureValidToken(
  { accessToken, refreshToken },
  getOidcConfig,
  60000,
  oidcScope,
  logger
)
```

## Configuration

### Plugin options

- `oidc` - OIDC configuration object:
  - `clientId` - OIDC client ID
  - `discoveryUri` - URL for OIDC discovery document
  - `authProvider` - Token provider (`CognitoTokenProvider` or `MockProvider`)
  - `useHttp` - Boolean flag to allow insecure HTTP requests for discovery (default: false)
  - `loginCallbackUri` - Redirect URI after OIDC login
  - `scope` - Space-separated string of scopes
  - `externalBaseUrl` - Base URL used to construct absolute callback URLs
  - `defaultPostLoginUri` - Redirect URI after login if not otherwise specified (default: `'/'`)
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
import { config } from '../../../config/config.js'
import {
  CognitoTokenProvider,
  HapiAuthOidcPlugin,
  MockProvider
} from '@defra/hapi-auth-oidc'

const authProvider = config.get('isProduction')
  ? new CognitoTokenProvider({
      poolId: config.get('azureFederatedCredentials.identityPoolId'),
      logins: { 'cdp-portal-frontend-aad-access': 'cdp-portal-frontend' }
    })
  : new MockProvider({})

const oidcCookieConfig = config.get('hapi-auth-oidc.cookie')

export const AuthOidcPlugin = {
  plugin: HapiAuthOidcPlugin,
  options: {
    oidc: {
      clientId: config.get('azureClientId'),
      discoveryUri: config.get('oidcWellKnownConfigurationUrl'),
      authProvider,
      useHttp: config.get('isProduction'),
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
