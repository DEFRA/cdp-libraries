export default {
  version: false,
  npm: {
    publish: false
  },
  git: {
    commitMessage: 'Released ${name} ${version}', // eslint-disable-line no-template-curly-in-string
    tagName: '${name}-${version}', // eslint-disable-line no-template-curly-in-string
    publish: false,
    requireCleanWorkingDir: false
  }
}
