export default {
  increment: 'minor',
  git: {
    commitMessage: 'Released cdp-validation-kit ${version}', // eslint-disable-line no-template-curly-in-string
    tagName: 'cdp-validation-kit-${version}', // eslint-disable-line no-template-curly-in-string
    requireCleanWorkingDir: false
  }
}
