#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const dependabotPath = join(ROOT, '.github', 'dependabot.yml')
const MARKER = '# ---- GENERATED: DO NOT EDIT BELOW ----'

function readYamlHead(path, marker) {
  const raw = readFileSync(path, 'utf8')
  const idx = raw.indexOf(marker)
  if (idx === -1) {
    throw new Error(
      `Marker not found in ${path}. Add the marker line to allow generation.`
    )
  }
  return raw.slice(0, idx + marker.length) + '\n'
}

function listWorkspaces() {
  const pkgsDir = join(ROOT, 'packages')
  let entries = []
  try {
    const children = readdirSync(pkgsDir, { withFileTypes: true })
    for (const d of children) {
      if (!d.isDirectory()) continue
      const pkgJson = join(pkgsDir, d.name, 'package.json')
      try {
        const pkg = JSON.parse(readFileSync(pkgJson, 'utf8'))
        const dir = `/packages/${d.name}`
        const name = pkg.name || d.name
        entries.push({ dir, name })
      } catch {
        // skip non-packages
      }
    }
  } catch {
    // no packages dir
  }
  entries.sort((a, b) => a.dir.localeCompare(b.dir))
  return entries
}

function blockFor(dir, name) {
  return [
    '',
    `  - package-ecosystem: "npm"`,
    `    directory: "${dir}"`,
    `    schedule:`,
    `      interval: "weekly"`,
    `    open-pull-requests-limit: 10`,
    `    versioning-strategy: increase`,
    `    commit-message:`,
    `      prefix: "deps"`,
    `      include: "scope"`,
    `    labels:`,
    `      - "deps"`,
    `      - "npm"`,
    `    groups:`,
    `      minor-and-patch:`,
    `        update-types:`,
    `          - "minor"`,
    `          - "patch"`,
    `    # workspace: ${name}`
  ].join('\n')
}

function main() {
  const head = readYamlHead(dependabotPath, MARKER).trimEnd()
  const workspaces = listWorkspaces()
  const blocks = workspaces.map((w) => blockFor(w.dir, w.name)).join('\n')
  const out = `${head}${blocks}\n`
  writeFileSync(dependabotPath, out)
  console.log(
    `Wrote ${dependabotPath} with ${workspaces.length} workspace entries`
  )
}

main()
