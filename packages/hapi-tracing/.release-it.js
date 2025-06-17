export default {
  increment: 'minor',
  git: {
    commitMessage: 'Released hapi-tracing ${version}', // eslint-disable-line no-template-curly-in-string
    tagName: 'hapi-tracing-${version}', // eslint-disable-line no-template-curly-in-string
    requireCleanWorkingDir: false
  }
}
