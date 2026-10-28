// Data Prepper key paths, as used in cdp-logs-pipeline.yaml and include_keys.
// `/` separates nested keys, `.` is part of the key name: `trace.id` is
// {"trace.id": …}, `trace/id` is {"trace": {"id": …}}. Leading `/` optional.

export const isMap = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const splitPath = (path) => path.split('/').filter(Boolean)

function parentOf(obj, parts) {
  let current = obj
  for (const part of parts.slice(0, -1)) {
    current = isMap(current) ? current[part] : undefined
  }
  return isMap(current) ? current : undefined
}

export function hasPath(obj, path) {
  const parts = splitPath(path)
  const parent = parentOf(obj, parts)
  return parent !== undefined && Object.hasOwn(parent, parts.at(-1))
}

export function getPath(obj, path) {
  const parts = splitPath(path)
  return parentOf(obj, parts)?.[parts.at(-1)]
}

export function setPath(obj, path, value) {
  const parts = splitPath(path)
  let current = obj
  for (const part of parts.slice(0, -1)) {
    if (!isMap(current[part])) current[part] = {}
    current = current[part]
  }
  current[parts.at(-1)] = value
}

export function deletePath(obj, path) {
  const parts = splitPath(path)
  const parent = parentOf(obj, parts)
  if (parent) delete parent[parts.at(-1)]
}

// {a: {b: 1}, 'c.d': 2} → ['a/b', 'c.d']
export const leafPaths = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}/${key}` : key
    return isMap(value) ? leafPaths(value, path) : [path]
  })
