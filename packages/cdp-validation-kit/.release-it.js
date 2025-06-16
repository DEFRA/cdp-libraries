export default {
  increment: 'minor',
  git: {
    commitMessage: 'Released ${name} ${version}', // eslint-disable-line no-template-curly-in-string
    tagName: '${name}-${version}', // eslint-disable-line no-template-curly-in-string
    requireCleanWorkingDir: false
  }
}
