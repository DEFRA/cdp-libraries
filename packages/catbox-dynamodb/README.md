# @defra/catbox-dynamodb

A [Catbox](https://hapi.dev/module/catbox/) compatible caching engine that uses Amazon DynamoDB as the backing store.

## Installation

```bash
npm install @defra/catbox-dynamodb
```

## Usage

### Standalone

```js
import { CatboxDynamoDB } from '@defra/catbox-dynamodb'

const engine = new CatboxDynamoDB({
  tableName: 'my-cache-table',
  ttl: 60000, // optional, defaults to 1 hour
  clientOptions: { region: 'eu-west-2' },
  logger
})

await engine.start()
const ready = await engine.isReady()
```

### With hapi Catbox

This engine can be plugged into hapi’s Catbox cache system.

```js
import Hapi from '@hapi/hapi'
import Catbox from '@hapi/catbox'
import { CatboxDynamoDB } from '@defra/catbox-dynamodb'

const server = Hapi.server({
  port: 3000,
  cache: [
    {
      name: 'session',
      provider: {
        constructor: CatboxDynamoDB,
        options: {
          tableName: 'test-session-cache',
          ttl: 60 * 1000,
          clientOptions: {
            endpoint: 'http://127.0.0.1:4566', // localstack endpoint
            region: 'eu-west-2'
          },
          logger
        }
      }
    }
  ]
})

// Example route using the session cache
server.route({
  method: 'GET',
  path: '/',
  handler: async (request, h) => {
    const cache = server.cache({ cache: 'session', segment: 'sessions' })
    const key = 'user:123'
    const cached = await cache.get(key)
    if (!cached) {
      await cache.set(key, { name: 'Alice' }, 60000)
      return 'New session cached'
    }
    return `Session restored for ${cached.name}`
  }
})

await server.start()
```

### Configuration Example

A config-driven setup can select the cache backend (DynamoDB, Redis, or memory). Example:

```js
if (engine === 'dynamodb') {
  return new CatboxDynamoDB({
    tableName: config.get('dynamoDb.tableName'),
    ttl: config.get('session.cache.ttl'),
    clientOptions: {
      endpoint: config.get('dynamoDbEndpoint'),
      region: config.get('awsRegion')
    },
    logger
  })
}
```

This works with LocalStack by pointing the DynamoDB client to the LocalStack endpoint.

## DynamoDB Table Schema

Your DynamoDB table must have a primary key named `id` of type `String`. The engine manages these attributes:

- `value` (String) stores the serialized cache entry
- `timestamp` (Number) stores the insertion timestamp in milliseconds
- `expiresAt` (Number) stores the absolute expiration time in milliseconds

Expired items remain in the table until overwritten or deleted, but the engine will not return them when retrieved. A TTL should be set up on expiresAt on the dynamoDB table to clear these entries.

## LocalStack Setup

The following commands will create a DynamoDB table and enable TTL on the `expiresAt` field using LocalStack:

```bash
aws --endpoint http://localhost:4566 dynamodb create-table \
  --region eu-west-2 \
  --table-name test-session-cache \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --provisioned-throughput ReadCapacityUnits=1,WriteCapacityUnits=1

aws --endpoint http://localhost:4566 dynamodb update-time-to-live \
  --region eu-west-2 \
  --table-name test-session-cache \
  --time-to-live-specification "Enabled=true,AttributeName=expiresAt"
```
