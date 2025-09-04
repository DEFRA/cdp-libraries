import Joi from 'joi'

import { ecsCpuToMemoryOptionsMap } from './constants/ecs-cpu-to-memory-options-map.js'
import { buildMemoryValidation } from './constants/build-memory-validation.js'
import {
  environments,
  environmentsExceptForProd
} from './constants/environments.js'

export { scopes } from './constants/scopes.js'
export { statusCodes } from './constants/status-codes.js'
export { entityTypes, entitySubTypes } from './constants/entities.js'

const environmentValidation = Joi.string()
  .valid(...Object.values(environments))
  .required()

const environmentExceptForProdValidation = Joi.string()
  .valid(...environmentsExceptForProd)
  .required()

const currentEnvironmentValidation = Joi.string()
  .valid('local', ...Object.values(environments))
  .required()

const zoneValidation = Joi.string().valid('public', 'protected').required()

const entityStatusValidation = Joi.string()
  .valid('Creating', 'Created')
  .required()

const entityTypeValidation = Joi.string()
  .valid('Microservice', 'TestSuite', 'Repository', 'Prototype')
  .required()

const entitySubTypeValidation = Joi.string()
  .valid('Frontend', 'Backend', 'Journey', 'Performance')
  .optional()

const displayNameValidation = Joi.string().required()

const userIdValidation = Joi.string().required()

const userWithIdValidation = Joi.object({
  id: userIdValidation,
  displayName: displayNameValidation
})

const userWithUserIdValidation = Joi.object({
  userId: userIdValidation,
  displayName: displayNameValidation
})

const teamIdValidation = Joi.string().required()
const teamIdsValidation = Joi.array().items(teamIdValidation).min(1).required()

const teamValidation = Joi.object({
  teamId: teamIdValidation,
  name: displayNameValidation
})

const validCpuValues = Object.keys(ecsCpuToMemoryOptionsMap).map((cpu) =>
  Number.parseInt(cpu)
)

const memoryValidation = buildMemoryValidation().required()

const versionValidation = Joi.string()
  .pattern(/^\d+\.\d+\.\d+$/)
  .required()

const instanceCountValidation = Joi.number().min(0).max(10).required()

const cpuValidation = Joi.number()
  .valid(...validCpuValues)
  .required()

const runIdValidation = Joi.string().guid().required()
const migrationIdValidation = Joi.string().required()
const migrationVersionValidation = Joi.string().required()

const deploymentIdValidation = Joi.string().guid().required()

const repositoryNameValidation = Joi.string()
  .min(1)
  .max(32)
  .required()
  .custom((value, helpers) => {
    if (!/^[a-z0-9-]*$/.test(value)) {
      return helpers.message('Letters and numbers with hyphen separators')
    } else if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(value)) {
      return helpers.message('Start and end with a letter or number')
    } else if (/.*-ddl$/.test(value)) {
      return helpers.message('Must not end with "-ddl"')
    } else {
      return value // Valid input
    }
  }, 'Custom repository name validation')
  .messages({
    'string.empty': 'Enter repository name',
    'string.min': '1 character or more',
    'string.max': '32 characters or less'
  })

const entityValidation = Joi.object({
  name: repositoryNameValidation,
  type: entityTypeValidation,
  subType: entitySubTypeValidation,
  primaryLanguage: Joi.string().optional(),
  created: Joi.date().required(),
  creator: userWithIdValidation,
  teams: Joi.array().items(teamValidation).required(),
  status: entityStatusValidation,
  decommissioned: Joi.object().optional().allow(null)
})

const commitShaValidation = Joi.string().required()

const templateBranchNameValidation = Joi.string().min(1).max(62).optional()

const templateTypeValidation = Joi.string()
  .valid('frontend', 'backend')
  .required()

export {
  commitShaValidation,
  cpuValidation,
  currentEnvironmentValidation,
  deploymentIdValidation,
  entityStatusValidation,
  entitySubTypeValidation,
  entityTypeValidation,
  entityValidation,
  environmentExceptForProdValidation,
  environmentValidation,
  environments,
  instanceCountValidation,
  memoryValidation,
  migrationIdValidation,
  migrationVersionValidation,
  repositoryNameValidation,
  runIdValidation,
  teamIdValidation,
  teamIdsValidation,
  teamValidation,
  templateBranchNameValidation,
  templateTypeValidation,
  userIdValidation,
  userWithIdValidation,
  userWithUserIdValidation,
  versionValidation,
  zoneValidation
}
