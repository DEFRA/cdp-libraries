# CDP Libraries

A mono-repo containing libraries for the CDP (Core Delivery Platform) ecosystem. This mono-repo provides the ability
to simply create and manage CDP packages, ensuring consistency and ease of use across different projects.

- [Requirements](#requirements)
  - [Node.js](#nodejs)
- [Local development](#local-development)
  - [Setup](#setup)
- [Creating a new package](#creating-a-new-package)
- [Global tooling](#global-tooling)
- [Testing your changes](#testing-your-changes)
- [Not releasing](#not-releasing)
- [Releasing](#releasing)
- [Changesets](#changesets)
- [Release it](#release-it)

## Requirements

To get started with the CDP Libraries mono-repo, you need to have Node.js and npm installed on your machine.

### Node.js

Please install [Node.js](http://nodejs.org/) `>= v22` and [npm](https://nodejs.org/) `>= v9`.

> [!TIP]
> To install Node.js and npm Use Node Version Manager [nvm](https://github.com/creationix/nvm)

To use the correct version of Node.js for this mono-repo, via nvm:

```bash
cd cdp-libraries
nvm use
```

## Local development

### Setup

Install all dependencies:

```bash
npm install
```

## Creating a new package

- Copy and rename an existing package in the `packages` directory to create a new package
- If they exist, remove `coverage` and `node_modules` directories from the new package
- Empty the `src` folder in the new package
- Update the `README.md` file in the new package with relevant information about your package
- Update the `package.json` file in the new package with relevant information:
  - Update the `name` field to a unique name for your package
  - Update the `version` field to `0.0.1`
  - Update the `description` field with a brief description of your package
  - Update the `repository` field with the URL of your new package's readme
  - Update the `release-it` object to include the new package. The config should be ok for you but you will need to use
    your new package name
- Update dependabot by running `node scripts/generate-dependabot.js`
- Now you have all you need to start developing your new package

## Global tooling

The following tools are available for free from the root of `cdp-libraries`. You do not need to install these in
your `package.json` file, as they are already included in the root `package.json`:

- `vitest` - for running tests
- `neostandard` - for linting code
- `release-it` - for managing releases
- `prettier` - for code formatting
- `husky` - for managing git hooks

## Testing your changes

To test your changes in this repo in a local consuming codebase, `npm link` is your friend here. Have a read
of https://docs.npmjs.com/cli/v9/commands /npm-link

## Not releasing

If you have changes you wish to commit but do not want to release a new version of the package, or tag and release the
package on GitHub. You can simply just make your commits as normal and raise a PR. There is no need to create a
changeset. This is usually documentation or items in the `root` that do not need to be published.

> [!TIP]
> For any changes in the `packages` directory, you should always create a changeset so they are released when your PR is
> merged

## Releasing

TL;DR: Releasing a new version of a package is as simple as running `npm run changeset` in root directory and merging a PR.

- Developer writes changeset
- Chooses correct bump for changes
- CI does everything else. Versions, tags, releases and publishes

Read on for detailed instructions. Releasing to `npm` and tagging on `GitHub` is done using
the [changeset](https://github.com/changesets/changesets) and [release-it](https://github.com/release-it/release-it)
tools, which is configured in the root of the workspace. This is super simple and all you need to do is:

After you have commited your work and are ready to release a new version of your package:

- Run `npm run changeset` to create a new changeset
- Commit the changeset file that was created in the `.changeset` directory
- Raise a PR with the changes you want to release
- Wait for `status required checks` to pass
- Get the PR reviewed and approved by at least one other developer
- Get an approval from the `cdp-libraries` owners
- Merge the PR into `main` branch
- The `cdp-libraries` GitHub Action will automatically run the `changeset` and `release-it` tool, which will:
  - Bump the version number in the `package.json` file
  - Create a new tag and release in GitHub with the new version number
  - Push the changes to the `main` branch
  - Publish the package to npm

## Changesets

This project uses [changeset](https://github.com/changesets/changesets) for managing versioning of packages. This is
already set up to go and works on `CI` automatically.

## Release it

This project uses [release-it](https://github.com/release-it) for managing releases. It automates the process of
tagging and releasing to GitHub. It is set up to go.
