/**
 * Starts the API for the end-to-end tests (Playwright's `webServer` runs it with plain `node`,
 * which strips the types): a new empty database `api/data/e2e.db`, migrated, then the API on
 * `E2E_API_PORT` with its stdout written to `playwright/api.log`, where `readMail()` finds the
 * sign-in codes the `console` email provider prints. Nothing here may import project files.
 */
import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createWriteStream, mkdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const webDir = resolve(import.meta.dirname, '../..')
const apiDir = resolve(webDir, '../api')
const logFile = join(webDir, 'playwright', 'api.log')
const port = process.env['E2E_API_PORT'] ?? '3100'
const webOrigin = process.env['E2E_WEB_ORIGIN'] ?? 'https://localhost:4300'

const env: NodeJS.ProcessEnv = {
  ...process.env,
  PORT: port,
  NODE_ENV: 'development',
  BASE_URL: `http://localhost:${port}`,
  CORS_ORIGINS: webOrigin,
  WEB_ORIGIN: webOrigin,
  TRUST_PROXY_HOPS: '1',
  LOG_LEVEL_CONSOLE: 'warn',
  LOG_LEVEL_FILE: 'warn',
  LOG_LEVEL_ERROR_FILE: 'error',
  LOG_FILE_ENABLED: 'false',
  EMAIL_PROVIDER: 'console',
  SMS_PROVIDER: 'console',
  DATABASE_URL: 'file:./data/e2e.db',
  DATABASE_AUTH_TOKEN: '',
  JWT_SECRET: randomBytes(32).toString('hex'),
  OTP_PEPPER: randomBytes(32).toString('hex'),
  SIGNUP_ENABLED: 'true',
  DEMO_ENABLED: 'false',
  PASSWORD_BREACH_CHECK: 'off',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  TURNSTILE_SITE_KEY: '',
  TURNSTILE_SECRET_KEY: '',
  LIVE_PROVIDER: 'disabled',
}

// A clean database every run.
for (const suffix of ['', '-journal', '-wal', '-shm']) {
  rmSync(join(apiDir, 'data', `e2e.db${suffix}`), { force: true })
}
const migrated = spawnSync(process.execPath, ['--import', 'tsx', 'src/core/database/migrate.ts'], {
  cwd: apiDir,
  env,
  stdio: 'inherit',
})
if (migrated.status !== 0) {
  process.exit(migrated.status ?? 1)
}

mkdirSync(join(webDir, 'playwright'), { recursive: true })
const log = createWriteStream(logFile, { flags: 'w' })
const api = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
  cwd: apiDir,
  env,
  stdio: ['ignore', 'pipe', 'inherit'],
})
api.stdout.pipe(log)
api.on('exit', (code) => process.exit(code ?? 0))
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => api.kill(signal))
}
