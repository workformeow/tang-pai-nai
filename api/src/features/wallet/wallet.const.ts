export const WALLET_LIMITS = {
  NAME_MAX: 50,
  ICON_MAX: 40,
  SORT_ORDER_MAX: 1_000_000,
  /** ±10¹⁵ minor units (wallet rule 5). */
  BALANCE_MAX: 1_000_000_000_000_000,
  /** Non-archived wallets per book (wallet rule 3). */
  PER_BOOK: 20,
  /** Ids in `hiddenCategoryIds` (category rule 13). */
  HIDDEN_CATEGORIES_MAX: 200,
} as const

export const WALLET_PATTERN = {
  /** A lucide export name or one of our own `tpn` icons (wallet rule 8). */
  ICON: /^(lucide|tpn)[A-Z][A-Za-z0-9]*$/,
  COLOR: /^#[0-9a-f]{6}$/,
  CURRENCY: /^[A-Z]{3}$/,
} as const

export const WALLET_MESSAGE = {
  BOOK_GONE: 'The book does not exist or was deleted',
  BOOK_FIXED: 'A wallet cannot move to another book',
  CURRENCY_INACTIVE: 'The currency is not available',
  CURRENCY_FIXED: 'A wallet with transactions cannot change its currency',
  NAME_TAKEN: 'A wallet with this name already exists in this book',
  TOO_MANY: `A book can have at most ${WALLET_LIMITS.PER_BOOK} wallets`,
  CARD_IN_TOTAL: 'A credit card must be excluded from the total',
} as const
