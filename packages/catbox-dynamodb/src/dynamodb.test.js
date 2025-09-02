import { CatboxDynamoDB } from './dynamodb'
import {
  DynamoDBClient,
  PutItemCommand,
  DeleteItemCommand,
  DescribeTableCommand
} from '@aws-sdk/client-dynamodb'

vi.mock('@aws-sdk/client-dynamodb', () => {
  return {
    DynamoDBClient: vi.fn().mockImplementation(() => ({
      send: vi.fn()
    })),
    GetItemCommand: vi.fn(),
    PutItemCommand: vi.fn(),
    DeleteItemCommand: vi.fn(),
    DescribeTableCommand: vi.fn()
  }
})

describe('#CatboxDynamoDB', () => {
  let clientSend
  let engine

  beforeEach(() => {
    clientSend = vi.fn()
    DynamoDBClient.mockImplementation(() => ({ send: clientSend }))
    engine = new CatboxDynamoDB({
      tableName: 'test-table',
      ttl: 1000,
      logger: { error: vi.fn(), debug: vi.fn() }
    })
  })

  test('Should throw when tableName is missing', () => {
    expect(() => new CatboxDynamoDB({})).toThrow('tableName is required')
  })

  test('Should validate segment name', () => {
    expect(engine.validateSegmentName('valid')).toBeNull()
  })

  test('Should error on empty segment name', () => {
    expect(() => engine.validateSegmentName('')).toThrow('Empty segment name')
  })

  test('Should error on invalid segment name', () => {
    expect(() => engine.validateSegmentName('bad\0name')).toThrow(
      'Invalid segment name: bad\0name'
    )
  })

  test('Should return true from isReady when table exists', async () => {
    clientSend.mockResolvedValueOnce({})
    const result = await engine.isReady()
    expect(result).toBe(true)
    expect(clientSend).toHaveBeenCalledWith(expect.any(DescribeTableCommand))
  })

  test('Should return false from isReady when table does not exist', async () => {
    clientSend.mockRejectedValueOnce({ name: 'ResourceNotFoundException' })
    const result = await engine.isReady()
    expect(result).toBe(false)
  })

  test('Should throw error from isReady when unexpected error occurs', async () => {
    const error = new Error('boom')
    clientSend.mockRejectedValueOnce(error)
    await expect(engine.isReady()).rejects.toThrow('boom')
  })

  test('Should return null when get finds no item', async () => {
    clientSend.mockResolvedValueOnce({ Item: undefined })
    const result = await engine.get({ id: 'missing' })
    expect(result).toBeNull()
  })

  test('Should return null when item is expired', async () => {
    const now = Date.now()
    clientSend.mockResolvedValueOnce({
      Item: {
        id: { S: 'expired' },
        value: { S: '{}' },
        timestamp: { N: now.toString() },
        expiresAt: { N: (now - 1000).toString() }
      }
    })
    const result = await engine.get({ id: 'expired' })
    expect(result).toBeNull()
  })

  test('Should parse and return cached item', async () => {
    const now = Date.now()
    clientSend.mockResolvedValueOnce({
      Item: {
        id: { S: 'abc' },
        value: { S: '{"foo":"bar"}' },
        timestamp: { N: now.toString() },
        expiresAt: { N: (now + 1000).toString() }
      }
    })
    const result = await engine.get({ id: 'abc' })
    expect(result.item).toEqual({ foo: 'bar' })
    expect(result.stored).toBe(now)
    expect(result.ttl).toBeGreaterThan(0)
  })

  test('Should fallback to raw string if value cannot be parsed', async () => {
    const now = Date.now()
    clientSend.mockResolvedValueOnce({
      Item: {
        id: { S: 'raw' },
        value: { S: 'not-json' },
        timestamp: { N: now.toString() },
        expiresAt: { N: (now + 1000).toString() }
      }
    })
    const result = await engine.get({ id: 'raw' })
    expect(result.item).toBe('not-json')
  })

  test('Should throw if set is called with invalid ttl', async () => {
    await expect(engine.set({ id: 'bad' }, { a: 1 }, 0)).rejects.toThrow(
      'TTL must be a positive number'
    )
  })

  test('Should call DynamoDB PutItemCommand on set', async () => {
    clientSend.mockResolvedValueOnce({})
    await engine.set({ id: 'good' }, { a: 1 }, 5000)
    expect(PutItemCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'test-table',
        Item: expect.objectContaining({
          id: { S: 'good' }
        })
      })
    )
  })

  test('Should call DynamoDB DeleteItemCommand on drop', async () => {
    clientSend.mockResolvedValueOnce({})
    await engine.drop({ id: 'gone' })
    expect(DeleteItemCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'test-table',
        Key: { id: { S: 'gone' } }
      })
    )
  })
})
