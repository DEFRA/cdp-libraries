# CDP Libraries

A mono-repo containing libraries for the CDP (Core Delivery Platform) ecosystem. This mono-repo provides the ability
to simply create and manage CDP packages, ensuring consistency and ease of use across different projects.

- [Requirements](#requirements)
  - [Node.js](#nodejs)
- [Local development](#local-development)
  - [Setup](#setup)
- [Getting Started](#getting-started)
- [Global tooling](#global-tooling)
- [Testing your changes in a consuming codebase](#testing-your-changes-in-a-consuming-codebase)
- [Releasing](#releasing)
- [Release it](#release-it)
- [Configuration](#configuration)
  - [Git Configuration](#git-configuration)
  - [NPM Configuration](#npm-configuration)

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

Install dependencies:

```bash
npm install
```

## Getting Started

- Copy and rename an existing package in the `packages` directory to create a new package
- If they exist, remove `coverage` and `node_modules` directories from the new package
- Empty the `src` folder in the new package
- Update the `README.md` file in the new package with relevant information about your package
- Update the `package.json` file in the new package with relevant information:
  - Update the `name` field to a unique name for your package
  - Update the `version` field to `0.0.1`
  - Update the `description` field with a brief description of your package
  - Update the `repository` field with the URL of your new package's readme
  - Update the `release-it` object to include the new package. Ensure that the `git` and `npm` configurations are
    correct for your package. See [Configuration](#configuration)
- Now you have all you need to start developing your new package

## Global tooling

The following tools are available for free from the root of `cdp-libraries`. You do not need to install these in
your `package.json` file, as they are already included in the root `package.json`:

- `vitest` - for running tests
- `neostandard` - for linting code
- `release-it` - for managing releases
- `prettier` - for code formatting
- `husky` - for managing git hooks

## Testing your changes in a consuming codebase

To test your changes in this repo in a local consuming codebase, `npm link` is your friend here. Have a read
of https://docs.npmjs.com/cli/v9/commands/npm-link

## Releasing

TL;DR: Releasing a new version of a package is as simple as running `npm run changeset` and merging a PR.

- Developer writes changeset
- Chooses correct bump for changes
- CI does everything else. Versions, tags, releases, publishes — automated

Releasing to `npm` and tagging on `GitHub` is done using the [changeset](https://github.com/changesets/changesets)
and [release-it](https://github.com/release-it/release-it) tools, which is configured in the root of the workspace.
This is super simple and all you need to do is:

After you have commited your work and are ready to release a new version of your package:

- Run `npm run changeset` to create a new changeset
- Commit the changeset file that was created in the `.changeset` directory
- Raise a PR with the changes you want to release
- Wait for `status required checks` to pass
- Get the PR reviewed and approved by at least one other developer
- Get an approval from the `cdp-libraries` owners
- Merge the PR into `main` branch
- The `cdp-libraries` GitHub Action will automatically run the `release-it` tool, which will:
  - Bump the version number in the `package.json` file
  - Create a new tag in Git with the new version number
  - Push the changes to the `main` branch
  - Publish the package to npm

## Release it

This project uses [release-it](https://github.com/release-it) for managing releases. It automates the process of
versioning, tagging, and publishing packages to npm.
It is set up to go. However, if you wish to tweak it, you can do so by modifying the `.release-it.js` file in the root
of workspace package.

## Configuration

For further information on how to configure `release-it` see
the https://github.com/release-it/release-it/blob/main/docs/configuration.md

### Git Configuration

For further information around `git` config see https://github.com/release-it/release-it/blob/main/docs/git.md

### NPM Configuration

For further information around `npm` config see https://github.com/release-it/release-it/blob/main/docs/npm.md
