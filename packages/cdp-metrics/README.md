# cdp-metrics

A simple wrapper around [AWS Embedded Metrics Format (EMF)](https://github.com/awslabs/aws-embedded-metrics-node) for use in Node.js applications. It provides utilities for emitting CloudWatch compatible metrics using counters, timers, gauges, and size measurements with minimal boilerplate.

## Features

- Emit counters (Count unit)
- Time async function
- Emit gauges, byte sizes, and durations
- Optional logger injection for error tracking
- Easy to mock in unit tests

## Installation

```bash
npm install @defra/cdp-metrics
```

## Configuration

### Local development

This library uses AWS EMF to emit metrics. To **safely disable CloudWatch writes during development**, set the following environment variable:

```bash
AWS_EMF_ENVIRONMENT=Local
```

It is advised you do this in your `package.json` to prevent accidentally turning off metrics in your deployed services.

```json
{
  "scripts": {
    "dev": "AWS_EMF_ENVIRONMENT=Local run-p frontend:watch server:watch",
    "dev:debug": "AWS_EMF_ENVIRONMENT=Local run-p frontend:watch server:debug"
  }
}
```

## ⚠️ Production

**Do not set AWS_EMF_ENVIRONMENT=Local**, or metrics will be silently discarded. AWS EMF will automatically emit to CloudWatch metrics ECS environments.

## Usage

### Basic Metrics

```js
import { counter, timer, millis, gauge, byteSize } from '@defra/cdp-metrics'

await counter('processedItems', 5)
await millis('dbQueryTime', 128)
await gauge('inFlightJobs', 3)
await byteSize('responseSize', 1024)
```

### Timed Function

```js
await timer('myHandlerTime', async () => {
  // Do some async work
})
```

### With dimensions

```js
await counter('apiCall', 1, { service: 'user', route: '/login' })
```

### Hapi Plugin

To attach metrics to the server and request contexts and configure the logger:

```js
import { metrics } from '@defra/cdp-metrics'

await server.register(metrics)

server.metrics().counter('startup', 1)
request.metrics().timer('dbFetch', async () => fetchUsers())
```

## Testing

In your tests, mock the internal aws-embedded-metrics methods to verify emitted metrics:

```js
import { vi } from 'vitest'
import * as embedded from 'aws-embedded-metrics'

vi.spyOn(embedded, 'createMetricsLogger').mockImplementation(() => ({
  putMetric: vi.fn(),
  flush: vi.fn(),
  setDimensions: vi.fn()
}))
```

## Error Handling

If any metric fails to emit, a warning is logged (if a logger is set). You can inject your own logger:

```js
import { setLogger } from '@defra/cdp-metrics'
import pino from 'pino'

setLogger(pino())
```
