export const BOOK_LIMITS = {
  NAME_MAX: 30,
  ICON_MAX: 40,
  SORT_ORDER_MAX: 1_000_000,
  /** Live books per user (book rule 4). */
  PER_USER: 20,
} as const

export const BOOK_PATTERN = {
  /** A lucide export name, e.g. `lucideHouse` (book rule 3). */
  ICON: /^lucide[A-Z][A-Za-z0-9]*$/,
  COLOR: /^#[0-9a-f]{6}$/,
} as const

export const BOOK_MESSAGE = {
  NAME_TAKEN: 'A book with this name already exists',
  TOO_MANY: `A user can have at most ${BOOK_LIMITS.PER_USER} books`,
}
