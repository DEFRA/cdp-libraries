import Joi from 'joi'
import { describe, test, expect } from 'vitest'
import { buildMemoryValidation } from './build-memory-validation.js'
import { ecsCpuToMemoryOptionsMap } from './ecs-cpu-to-memory-options-map.js'

describe('#buildMemoryValidation', () => {
  const testValidationSchema = (cpu) =>
    Joi.object({ cpu, memory: buildMemoryValidation() })

  const validCpuValues = Object.keys(ecsCpuToMemoryOptionsMap).map((cpu) =>
    Number.parseInt(cpu)
  )

  validCpuValues.forEach((cpuValue) => {
    const allowedMemoryValues =
      ecsCpuToMemoryOptionsMap[cpuValue]?.map(({ value }) => value) ?? []

    describe(`When cpu is ${cpuValue}`, () => {
      allowedMemoryValues.forEach((memoryValue) => {
        describe(`And memory is ${memoryValue}`, () => {
          test('Should pass validation as expected', () => {
            expect(
              testValidationSchema(cpuValue).validate(
                { cpu: cpuValue, memory: memoryValue },
                { abortEarly: false }
              )
            ).toEqual({ value: { cpu: cpuValue, memory: memoryValue } })
          })
        })
      })
    })

    describe(`When cpu is ${cpuValue}`, () => {
      test('Error message for cpu and memory mismatch should be as expected', () => {
        expect(
          testValidationSchema(cpuValue).validate(
            { cpu: cpuValue, memory: 12345 },
            { abortEarly: false }
          )?.error?.message
        ).toContain(
          `"memory" must be one of [${allowedMemoryValues.join(', ')}]`
        )
      })
    })
  })
})
