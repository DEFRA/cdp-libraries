import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
  DescribeTableCommand
} from '@aws-sdk/client-dynamodb'

export class CatboxDynamoDB {
  constructor(options = {}) {
    if (!options.tableName) {
      throw new Error('tableName is required')
    }

    this.tableName = options.tableName
    this.defaultTtl = options.ttl ?? 3600_000 // 1 hour default
    this.logger = options.logger
    this.client = new DynamoDBClient(options.clientOptions ?? {})
    this.isTableActive = false
  }

  async start() {}
  async stop() {}

  async isReady() {
    if (!this.isTableActive) {
      try {
        const response = await this.client.send(
          new DescribeTableCommand({ TableName: this.tableName })
        )
        this.isTableActive = response?.Table?.TableStatus === 'ACTIVE'
        return this.isTableActive
      } catch (err) {
        console.log(err)
        if (err.name === 'ResourceNotFoundException') {
          this.logger?.error(err, `dynamodb table ${this.tableName} not found`)
          return false
        }
        this.logger?.error(err)
        throw err
      }
    }
  }

  validateSegmentName(name) {
    if (!name) {
      throw new Error('Empty segment name')
    }
    if (name.includes('\0')) {
      throw new Error(`Invalid segment name: ${name}`)
    }
    return null // valid
  }

  async get(key) {
    const { Item } = await this.client.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: { id: { S: key.id } }
      })
    )

    if (!Item) {
      this.logger?.debug(`dynamodb item for key ${key.id} not found`)
      return null
    }

    const now = Date.now()
    const expiresAt = Number(Item.expiresAt.N)

    if (expiresAt <= now) {
      this.logger?.debug(`dynamodb item for key ${key.id} has expired`)
      return null
    }

    let parsedItem
    try {
      parsedItem = JSON.parse(Item.value.S)
    } catch (err) {
      this.logger?.error(
        err,
        `dynamodb item for key ${key.id} could not be parsed`
      )
      parsedItem = Item.value.S // fallback to raw string
    }

    return {
      item: parsedItem,
      stored: Number(Item.timestamp.N),
      ttl: expiresAt - now
    }
  }

  async set(key, value, ttl) {
    const now = Date.now()
    const effectiveTtl = ttl ?? this.defaultTtl

    if (effectiveTtl <= 0) {
      throw new Error('TTL must be a positive number')
    }

    const expiresAt = now + effectiveTtl

    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: {
        id: { S: key.id },
        value: { S: JSON.stringify(value) },
        timestamp: { N: now.toString() },
        expiresAt: { N: expiresAt.toString() }
      }
    })

    await this.client.send(command)
  }

  async drop(key) {
    const command = new DeleteItemCommand({
      TableName: this.tableName,
      Key: { id: { S: key.id } }
    })

    await this.client.send(command)
  }
}
