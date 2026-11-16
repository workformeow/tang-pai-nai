import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Every temporary folder a test makes starts with this, so a sweep can find leftovers. */
export const TEMP_DIR_PREFIX = 'tpn-'

/** Error codes Windows answers when a file in the folder is still open. */
const LOCKED_CODES = new Set(['EPERM', 'EBUSY'])

const isWindowsLock = (error: unknown): boolean =>
  process.platform === 'win32' &&
  error instanceof Error &&
  'code' in error &&
  typeof error.code === 'string' &&
  LOCKED_CODES.has(error.code)

/** A new empty folder under the OS temp folder, e.g. `makeTempDir('wallet')` -> `.../tpn-wallet-XXXXXX`. */
export const makeTempDir = (name: string): string =>
  mkdtempSync(join(tmpdir(), `${TEMP_DIR_PREFIX}${name}-`))

/**
 * Removes a test's temporary folder. On Windows the libsql driver keeps the SQLite file open until
 * the process exits, even after `client.close()`, so the delete fails with EPERM/EBUSY there: that
 * case is skipped (`sweepTempDirs` removes the folder on a later run). Any other failure, and every
 * failure on Linux/macOS, still throws.
 */
export const removeTempDir = (dir: string): void => {
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch (error) {
    if (!isWindowsLock(error)) {
      throw error
    }
  }
}

/**
 * Removes leftover test folders older than `olderThanMs` (an hour by default, so a run going on in
 * another terminal keeps its folders). Best effort: a folder still locked stays for the next sweep.
 */
export const sweepTempDirs = (olderThanMs = 60 * 60 * 1000, now = Date.now()): void => {
  const root = tmpdir()
  for (const name of readdirSync(root)) {
    if (!name.startsWith(TEMP_DIR_PREFIX)) {
      continue
    }
    const dir = join(root, name)
    try {
      if (now - statSync(dir).mtimeMs > olderThanMs) {
        rmSync(dir, { recursive: true, force: true })
      }
    } catch {
      // Gone already, or still locked by another process: leave it for the next sweep.
    }
  }
}
