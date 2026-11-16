import { sweepTempDirs } from './temp-dir'

/** Vitest global setup: clears test folders an earlier run on Windows couldn't delete. */
export default function setup(): void {
  sweepTempDirs()
}
