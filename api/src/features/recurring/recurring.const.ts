export const RECURRING_LIMITS = {
  /** 10¹⁵ minor units (transaction rule 3). */
  AMOUNT_MAX: 1_000_000_000_000_000,
  NOTE_MAX: 500,
  INTERVAL_MAX: 99,
  COUNT_MAX: 999,
  /** Live rules per book (rule 1). */
  PER_BOOK: 100,
} as const

export const RecurringKind = {
  TRANSACTION: 'transaction',
  TRANSFER: 'transfer',
  /** A debt's repayment (docs/features/debt.md rule 13). */
  DEBT: 'debt',
} as const

export const RecurringFrequency = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  YEAR: 'year',
} as const

export const RECURRING_MESSAGE = {
  BOOK_GONE: 'The book does not exist or was deleted',
  BOOK_FIXED: 'A recurring rule cannot move to another book',
  WALLET_GONE: 'The wallet does not exist or was deleted',
  TO_WALLET_GONE: 'The wallet to transfer to does not exist or was deleted',
  CATEGORY_GONE: 'The category does not exist or was deleted',
  OTHER_BOOK: 'The wallets and the category must belong to the rule’s book',
  OTHER_CURRENCY: 'Both wallets must have the same currency',
  LIMIT: 'A book holds at most 100 recurring rules',
  KIND_FIELDS:
    'A transaction rule needs a category, a transfer rule a wallet to transfer to, a debt rule a debt',
  DEBT_GONE: 'The debt does not exist or was deleted',
  DEBT_OTHER_BOOK: 'The debt must belong to the rule’s book',
  DEBT_OTHER_CURRENCY: 'The wallet must have the debt’s currency',
  SAME_WALLET: 'A transfer needs two different wallets',
  END_BOTH: 'A rule ends on a date or after a count, not both',
  END_BEFORE_START: 'The end date must be on or after the start date',
  NEXT_BEFORE_START: 'The next date must be on or after the start date',
} as const
