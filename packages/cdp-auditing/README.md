# CDP Auditing

This package allows services to write audit messages to the CDP audit stream.

## Installation

```bash
npm i @defra/cdp-auditing
```

## Usage

The cdp-auditing library is not very complex.

### Basic auditing

To send a message to the audit stream, simply import the audit library and call the `audit()` function.

```js
import { audit } from '@defra/cdp-auditing'
audit('This is a test of auditing')
// {"log.level":"audit","time":"2025-07-04T11:46:33.278Z","msg":"This is a test of auditing"}
```

### Auditing structured data

You can also write structured data to the audit stream. Values passed in should be serializable as json.

```js
audit({ id: '1234', event: 'login', outcome: 'denied' }, 'Login failed')
// {"log.level":"audit","time":"2025-07-04T11:46:33.278Z","id":"1234","event":"login","outcome":"denied","msg":"Login failed"}

audit({ id: '1234', event: 'login', outcome: 'denied' })
// {"log.level":"audit","time":"2025-07-04T11:46:33.278Z","id":"1234","event":"login","outcome":"denied"}
```

When running locally, the audit messages will be printed to the console allowing you see what data will be auditing.

Auditing is enabled by default. To turn auditing on or off you can call:

```js
import { audit, enableAuditing } from '@defra/cdp-auditing'

// Turn auditing off
enableAuditing(false)

// Re-enable auditing
enableAuditing()
// or
enableAuditing(true)
```

## How auditing works on the CDP Platform

Auditing is basically just standard logger pre-configured to do the following:

- write to console/stdout
- write all messages as JSON
- ensures all messages include an ECS style `log.level` field set to `audit`

Services running on the CDP Platform are deployed with a log collection sidecar (FluentBit).

The log sidecar filters messaged based on their `log.level` field. Messages with `"log.level": "audit"` are
filtered out and send to the audit stream, while all other log levels are send to the OpenSearch pipeline.
