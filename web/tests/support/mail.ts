import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** What `start-api.ts` writes: the API's stdout, holding every mail the console provider printed. */
const LOG_FILE = join(import.meta.dirname, '..', '..', 'playwright', 'api.log')
const RULE = '─'.repeat(60)

/** A mail with a code: sign-in (with its magic link) or a step-up code (`link` null). */
export interface CodeMail {
  code: string
  link: string | null
  /** Where the mail starts in the log: tells two mails with the same code apart. */
  at: number
}

/** The newest mail with a code to `email` in the API's log, or null. */
const newestMail = (email: string): CodeMail | null => {
  if (!existsSync(LOG_FILE)) {
    return null
  }
  const log = readFileSync(LOG_FILE, 'utf8')
  const at = log.lastIndexOf(`To: ${email}\n`)
  if (at < 0) {
    return null
  }
  const block = log.slice(at).split(RULE)[0] ?? ''
  const code = block.match(/^\s*(\d{6})\s*$/m)?.[1]
  return code ? { code, link: block.match(/https?:\/\/\S+/)?.[0] ?? null, at } : null
}

/**
 * Waits for the newest mail with a code to `email`. Pass `after`, the mail read before the
 * action, to wait for a new one (a resend).
 */
export const readMail = async (email: string, after?: CodeMail): Promise<CodeMail> => {
  const until = Date.now() + 10_000
  for (;;) {
    const mail = newestMail(email)
    if (mail && mail.at !== after?.at) {
      return mail
    }
    if (Date.now() > until) {
      throw new Error(`No sign-in mail to ${email} in ${LOG_FILE}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}
