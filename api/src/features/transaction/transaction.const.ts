export const TRANSACTION_LIMITS = {
  /** 10¹⁵ minor units (transaction rule 3). */
  AMOUNT_MAX: 1_000_000_000_000_000,
  NOTE_MAX: 500,
} as const

export const TRANSACTION_MESSAGE = {
  BOOK_GONE: 'The book does not exist or was deleted',
  BOOK_FIXED: 'A transaction cannot move to another book',
  WALLET_GONE: 'The wallet does not exist or was deleted',
  CATEGORY_GONE: 'The category does not exist or was deleted',
  OTHER_BOOK: 'The wallet and the category must belong to the transaction’s book',
  CURRENCY_FIXED: 'A transaction cannot move to a wallet with another currency',
  DEBT_OTHER_BOOK: 'The debt must belong to the transaction’s book',
  DEBT_OTHER_CURRENCY: 'The wallet must have the debt’s currency',
  EVENT_OTHER_BOOK: 'The event must belong to the transaction’s book',
} as const
