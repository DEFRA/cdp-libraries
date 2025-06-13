import Joi from 'joi'
import { ecsCpuToMemoryOptionsMap } from './ecs-cpu-to-memory-options-map.js'

/**
 *
 * @returns {Joi.NumberSchema<number>}
 */
function buildMemoryValidation() {
  return Object.keys(ecsCpuToMemoryOptionsMap).reduce((joiNumber, cpu) => {
    const validMemoryValues = ecsCpuToMemoryOptionsMap[cpu]?.map(
      ({ value }) => value
    )

    return joiNumber.when('cpu', {
      is: Number.parseInt(cpu),
      then: Joi.number().valid(...validMemoryValues)
    })
  }, Joi.number())
}

export { buildMemoryValidation }
