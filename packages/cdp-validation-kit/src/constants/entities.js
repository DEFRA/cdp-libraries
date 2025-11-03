const entityTypes = {
  microservice: 'Microservice',
  repository: 'Repository',
  testSuite: 'TestSuite'
}

const entitySubTypes = {
  frontend: 'Frontend',
  backend: 'Backend',
  prototype: 'Prototype',
  performance: 'Performance',
  journey: 'Journey'
}

const entityStatuses = {
  created: 'Created',
  creating: 'Creating',
  decommissioned: 'Decommissioned',
  decommissioning: 'Decommissioning'
}

export { entityTypes, entitySubTypes, entityStatuses }
