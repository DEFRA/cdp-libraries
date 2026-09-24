export const environments = {
  management: 'management',
  infraDev: 'infra-dev',
  dev: 'dev',
  test: 'test',
  perfTest: 'perf-test',
  extTest: 'ext-test',
  prod: 'prod'
}

export const orderedEnvironments = [
  environments.infraDev,
  environments.management,
  environments.dev,
  environments.test,
  environments.perfTest,
  environments.extTest,
  environments.prod
]

export const environmentsExceptForProd = [
  environments.infraDev,
  environments.management,
  environments.dev,
  environments.test,
  environments.perfTest,
  environments.extTest
]

export const prototypeEnvironments = [
  environments.infraDev,
  environments.dev,
  environments.extTest
]

export const performanceEnvironments = [
  environments.infraDev,
  environments.management,
  environments.perfTest
]

export const environmentsExceptInfraDev = [
  environments.management,
  environments.dev,
  environments.test,
  environments.perfTest,
  environments.extTest,
  environments.prod
]

export const adminOnlyEnvironments = [
  environments.infraDev,
  environments.management
]

export const nonAdminEnvironments = [
  environments.dev,
  environments.test,
  environments.perfTest,
  environments.extTest,
  environments.prod
]
