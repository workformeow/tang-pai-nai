export const EVENT_LIMITS = {
  NAME_MAX: 50,
  ICON_MAX: 40,
  /** Open (not closed) events per book (event rule 1). */
  OPEN_PER_BOOK: 50,
} as const

export const EVENT_PATTERN = {
  /** A lucide export name or one of our own `tpn` icons (as wallets). */
  ICON: /^(lucide|tpn)[A-Z][A-Za-z0-9]*$/,
  COLOR: /^#[0-9a-f]{6}$/,
} as const

export const EVENT_MESSAGE = {
  BOOK_GONE: 'The book does not exist or was deleted',
  BOOK_FIXED: 'An event cannot move to another book',
  LIMIT: `A book holds at most ${EVENT_LIMITS.OPEN_PER_BOOK} open events`,
  END_BEFORE_START: 'An event cannot end before it starts',
} as const
