import { memoryRange } from './memory-range.js'
// Based on: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-tasks-services.html

const ecsCpuToMemoryOptionsMap = {
  512: memoryRange(1, 4),
  1024: memoryRange(2, 8),
  2048: memoryRange(4, 16),
  4096: memoryRange(8, 30),
  8192: memoryRange(16, 60, 4)
}

export { ecsCpuToMemoryOptionsMap }
