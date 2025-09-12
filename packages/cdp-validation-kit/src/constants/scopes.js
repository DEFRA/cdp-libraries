/* @type {Record<string, string>} */
const scopes = {
  admin: 'permission:admin',
  breakGlass: 'permission:breakGlass',
  canGrantBreakGlass: 'permission:canGrantBreakGlass',
  externalTest: 'permission:externalTest',
  restrictedTechPostgres: 'permission:restrictedTechPostgres',
  restrictedTechPython: 'permission:restrictedTechPython',
  serviceOwner: 'permission:serviceOwner',
  tenant: 'permission:tenant',
  testAsTenant: 'permission:testAsTenant'
}

const kindsOfScope = ['user', 'team', 'member']

export { scopes, kindsOfScope }
