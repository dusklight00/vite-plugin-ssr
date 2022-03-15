import { existsSync } from 'fs'
import { assertPosixPath, assertUsage, toPosixPath } from '../utils'
import path from 'path'
import symlinkDir from 'symlink-dir'
import resolve from 'resolve'

export { resolveGlobConfig }
export { getGlobPath }

function resolveGlobConfig(includePageFiles: string[]) {
  let globPaths: string[]
  return getGlobRoots
  async function getGlobRoots(root: string) {
    root = toPosixPath(root)
    if (!globPaths) {
      const entriesDefault = ['/']
      const entriesInclude = await Promise.all(includePageFiles.map((pkgName) => createIncludePath(pkgName, root)))
      globPaths = [...entriesDefault, ...entriesInclude]
    }
    return globPaths
  }
}

async function createIncludePath(pkgName: string, root: string): Promise<string> {
  assertUsage(
    isNpmName(pkgName),
    `Wrong vite-plugin-ssr config \`pageFiles.include\`: it contains \`${pkgName}\` which is not a valid npm package name.`,
  )
  let pkgJsonPath: string
  try {
    // We cannot use Node.js's `require.resolve()`: https://stackoverflow.com/questions/10111163/in-node-js-how-can-i-get-the-path-of-a-module-i-have-loaded-via-require-that-is/63441056#63441056
    pkgJsonPath = resolve.sync(`${pkgName}/package.json`, { preserveSymlinks: true, basedir: root })
  } catch (err) {
    assertUsage(false, `Cannot find \`${pkgName}\`. Did you install it?`)
  }
  pkgJsonPath = toPosixPath(pkgJsonPath)
  const pkgPath = path.posix.dirname(pkgJsonPath)
  const pkgPathRelative = path.posix.relative(root, pkgPath)
  if (!pkgPathRelative.startsWith('.')) {
    const includePath = pkgPathRelative
    assertPosixPath(includePath)
    return includePath
  }
  const includePath = `node_modules/${pkgName}`
  if (!existsSync(includePath)) {
    const cwd = toPosixPath(process.cwd())
    const source = path.posix.relative(cwd, pkgPath)
    const target = path.posix.relative(cwd, `${root}/${includePath}`)
    await symlinkDir(source, target)
  }
  assertPosixPath(includePath)
  return includePath
}

function isNpmName(str: string) {
  if (str.includes('\\')) {
    return false
  }
  if (!str.includes('/')) {
    return true
  }
  if (str.split('/').length === 2 && str.startsWith('@')) {
    return true
  }
  return false
}

function getGlobPath(
  globRoot: string,
  fileSuffix: 'page' | 'page.client' | 'page.server' | 'page.route',
  root?: string,
): string {
  // Vite uses `fast-glob` which resolves globs with micromatch: https://github.com/micromatch/micromatch
  // Pattern `*([a-zA-Z0-9])` is an Extglob: https://github.com/micromatch/micromatch#extglobs
  const fileExtention = '*([a-zA-Z0-9])'
  assertPosixPath(globRoot)
  let globPath = [...globRoot.split('/'), '**', `*.${fileSuffix}.${fileExtention}`].filter(Boolean).join('/')
  if (root) {
    globPath = toPosixPath(path.posix.join(root, globPath))
  } else {
    globPath = '/' + globPath
  }
  return globPath
}