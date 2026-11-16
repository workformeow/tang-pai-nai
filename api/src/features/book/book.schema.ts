import { z } from 'zod'
import type { SyncValidation } from '@/core/sync'
import { ERRORS } from '@/shared/constants'
import { BOOK_LIMITS, BOOK_PATTERN } from './book.const'

const epochMs = z.number().int().nonnegative()

// A pushed book row (book rules 2–3). Server columns (`changeSeq`, `updatedBy`, `userId`)
// are ignored if sent.
const row = z.object({
  id: z.uuid({ error: ERRORS.invalidField('id') }),
  name: z
    .string({ error: ERRORS.requiredField('Name') })
    .trim()
    .min(1, ERRORS.requiredField('Name'))
    .max(BOOK_LIMITS.NAME_MAX, ERRORS.maxLength('Name', BOOK_LIMITS.NAME_MAX)),
  icon: z
    .string({ error: ERRORS.requiredField('Icon') })
    .max(BOOK_LIMITS.ICON_MAX, ERRORS.invalidField('icon'))
    .regex(BOOK_PATTERN.ICON, ERRORS.invalidField('icon')),
  color: z
    .string({ error: ERRORS.requiredField('Color') })
    .regex(BOOK_PATTERN.COLOR, ERRORS.invalidField('color')),
  sortOrder: z
    .number({ error: ERRORS.invalidType('Sort order', 'integer') })
    .int(ERRORS.invalidType('Sort order', 'integer'))
    .min(0, ERRORS.invalidField('sortOrder'))
    .max(BOOK_LIMITS.SORT_ORDER_MAX, ERRORS.invalidField('sortOrder')),
  createdAt: epochMs,
  updatedAt: epochMs,
  deletedAt: epochMs.nullable().default(null),
})

export const validateBook = (input: unknown): SyncValidation => {
  const result = row.safeParse(input)
  if (!result.success) {
    return { ok: false, message: result.error.issues.map((issue) => issue.message).join(', ') }
  }
  return { ok: true, row: result.data }
}
