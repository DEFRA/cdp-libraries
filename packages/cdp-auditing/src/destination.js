import pino from 'pino'

export const destStdout = pino.destination({ fd: 1, sync: false })
