import { createHash } from 'node:crypto'
import { v7 as uuidv7 } from 'uuid'

// docs/features/demo.md rules 6–7: the data a demo account starts with. A fixed template (the
// same amounts every time, owner-approved 2026-11-17), with dates counted back from the day the
// demo starts. Pure: no DB, no clock; the repository stamps the sync columns when it writes.

export type DemoLanguage = 'th' | 'en'

interface Text {
  th: string
  en: string
}

const t = (th: string, en: string): Text => ({ th, en })

/**
 * No note: the category already says it (owner, 2026-11-17: "กาแฟ" needs no "กาแฟเย็น"), as
 * people leave it in real use. A note is kept only where it adds something.
 */
const NO_NOTE = t('', '')

// ───────────────────────────── Rows (the synced tables, minus the sync columns) ─────────────────

export interface DemoBook {
  id: string
  name: string
  icon: string
  color: string
  sortOrder: number
}

export interface DemoWallet {
  id: string
  bookId: string
  name: string
  currencyCode: string
  initialBalance: number
  icon: string
  color: string
  excludeFromTotal: boolean
  isCreditCard: boolean
  isArchived: boolean
  sortOrder: number
  hiddenCategoryIds: string[]
}

export interface DemoCategory {
  id: string
  bookId: string
  type: 'income' | 'expense'
  parentId: string | null
  name: string
  icon: string
  color: string
  isArchived: boolean
  sortOrder: number
}

export interface DemoTransaction {
  id: string
  bookId: string
  walletId: string
  categoryId: string
  amount: number
  occurredOn: string
  note: string
  excludeFromReport: boolean
  recurringId: string | null
  eventId: string | null
  /** Epoch ms: the list orders a day's rows by it. */
  createdAt: number
}

export interface DemoTransfer {
  id: string
  bookId: string
  fromWalletId: string
  toWalletId: string
  amount: number
  occurredOn: string
  note: string
  createdAt: number
}

export interface DemoRecurringRule {
  id: string
  bookId: string
  walletId: string
  categoryId: string
  amount: number
  note: string
  startOn: string
  confirm: boolean
  nextOn: string
}

export interface DemoDebt {
  id: string
  bookId: string
  person: string
  note: string
  currencyCode: string
  dueOn: string
}

export interface DemoDebtEntry {
  id: string
  bookId: string
  debtId: string
  kind: 'principal' | 'repayment'
  walletId: string
  amount: number
  occurredOn: string
  note: string
  createdAt: number
}

export interface DemoEvent {
  id: string
  bookId: string
  name: string
  icon: string
  color: string
  startOn: string
  endOn: string
}

export interface DemoSeed {
  book: DemoBook
  wallets: DemoWallet[]
  categories: DemoCategory[]
  transactions: DemoTransaction[]
  transfers: DemoTransfer[]
  recurringRules: DemoRecurringRule[]
  debts: DemoDebt[]
  debtEntries: DemoDebtEntry[]
  events: DemoEvent[]
}

/** Every row the seed writes (rule 11 counts them against the demo's 2,000). */
export const demoSeedSize = (seed: DemoSeed): number =>
  1 +
  seed.wallets.length +
  seed.categories.length +
  seed.transactions.length +
  seed.transfers.length +
  seed.recurringRules.length +
  seed.debts.length +
  seed.debtEntries.length +
  seed.events.length

// ───────────────────────────── Dates ─────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000

/** `YYYY-MM-DD` of `at` in `timeZone`. */
export const localDay = (at: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)

const toUtc = (day: string) => Date.parse(`${day}T00:00:00Z`)
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10)

const addDays = (day: string, days: number): string => fromUtc(toUtc(day) + days * DAY_MS)

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

/** `day` of the month `months` after `from`'s; a missing day is the month's last (recurring rule 3). */
const monthDay = (from: string, months: number, day: number): string => {
  const date = new Date(toUtc(from))
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
  const year = first.getUTCFullYear()
  const month = first.getUTCMonth()
  return fromUtc(Date.UTC(year, month, Math.min(day, daysInMonth(year, month))))
}

const dayOfMonth = (day: string) => Number(day.slice(8, 10))

/** `from` plus `months`, its day kept (or the month's last). */
const addMonths = (from: string, months: number) => monthDay(from, months, dayOfMonth(from))

/** 0 = Sunday … 6 = Saturday. */
const weekday = (day: string) => new Date(toUtc(day)).getUTCDay()

/** Recurring rule 9: an occurrence's id is a UUID v8 from SHA-256 of `ruleId:day` (as the web). */
export const occurrenceId = (ruleId: string, day: string): string => {
  const bytes = createHash('sha256').update(`${ruleId}:${day}`).digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x80
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// ───────────────────────────── The template ──────────────────────────────────────────────────────

type CategoryKey =
  | 'food'
  | 'meals'
  | 'drinks'
  | 'transport'
  | 'metro'
  | 'publicTransport'
  | 'taxi'
  | 'rent'
  | 'water'
  | 'electricity'
  | 'internet'
  | 'shopping'
  | 'entertainment'
  | 'health'
  | 'education'
  | 'family'
  | 'gifts'
  | 'insurance'
  | 'travel'
  | 'otherExpense'
  | 'salary'
  | 'sales'
  | 'otherIncome'

interface CategorySeed {
  key?: CategoryKey
  name: Text
  icon: string
  color: string
  children?: CategorySeed[]
}

/**
 * The default set (category rule 8). The web keeps the same list in
 * `web/src/app/core/book/default-categories.ts` for a book a device creates; keep them alike.
 */
const CATEGORIES: Record<'expense' | 'income', CategorySeed[]> = {
  expense: [
    {
      key: 'food',
      name: t('อาหารและเครื่องดื่ม', 'Food & drink'),
      icon: 'lucideUtensils',
      color: '#c2410c',
      // Everyday meals and drinks apart; a pricier meal out goes on the parent itself.
      children: [
        {
          key: 'meals',
          name: t('อาหารประจำวัน', 'Daily meals'),
          icon: 'tpnNoodleBowl',
          color: '#c2410c',
        },
        { key: 'drinks', name: t('เครื่องดื่ม', 'Drinks'), icon: 'lucideCoffee', color: '#a16207' },
      ],
    },
    {
      key: 'transport',
      name: t('การเดินทาง', 'Transport'),
      icon: 'lucideCar',
      color: '#2563eb',
      children: [
        { name: t('น้ำมัน', 'Fuel'), icon: 'lucideFuel', color: '#2563eb' },
        { key: 'metro', name: t('รถไฟฟ้า', 'Metro'), icon: 'lucideTrainFront', color: '#0e7490' },
        {
          key: 'publicTransport',
          name: t('ขนส่งสาธารณะ', 'Public transport'),
          icon: 'lucideBus',
          color: '#15803d',
        },
        { key: 'taxi', name: t('แท็กซี่', 'Taxi'), icon: 'lucideCarTaxiFront', color: '#a16207' },
      ],
    },
    {
      name: t('ที่อยู่อาศัย', 'Housing'),
      icon: 'lucideHouse',
      color: '#0f766e',
      children: [
        { key: 'rent', name: t('ค่าเช่า', 'Rent'), icon: 'lucideKeyRound', color: '#0f766e' },
        { key: 'water', name: t('ค่าน้ำ', 'Water'), icon: 'tpnFaucet', color: '#0e7490' },
        {
          key: 'electricity',
          name: t('ค่าไฟ', 'Electricity'),
          icon: 'lucideZap',
          color: '#a16207',
        },
        {
          key: 'internet',
          name: t('อินเทอร์เน็ต', 'Internet'),
          icon: 'lucideWifi',
          color: '#9333ea',
        },
      ],
    },
    {
      key: 'shopping',
      name: t('ช้อปปิ้ง', 'Shopping'),
      icon: 'lucideShoppingBag',
      color: '#db2777',
    },
    {
      key: 'entertainment',
      name: t('บันเทิง', 'Entertainment'),
      icon: 'lucideClapperboard',
      color: '#9333ea',
    },
    { key: 'health', name: t('สุขภาพ', 'Health'), icon: 'lucideHeartPulse', color: '#dc2626' },
    {
      key: 'education',
      name: t('การศึกษา', 'Education'),
      icon: 'lucideGraduationCap',
      color: '#0e7490',
    },
    { key: 'family', name: t('ครอบครัว', 'Family'), icon: 'lucideUsers', color: '#15803d' },
    {
      key: 'gifts',
      name: t('ของขวัญและบริจาค', 'Gifts & donations'),
      icon: 'lucideGift',
      color: '#db2777',
    },
    {
      key: 'insurance',
      name: t('ประกัน', 'Insurance'),
      icon: 'lucideShieldCheck',
      color: '#475569',
    },
    { key: 'travel', name: t('ท่องเที่ยว', 'Travel'), icon: 'lucidePlane', color: '#0e7490' },
    { key: 'otherExpense', name: t('อื่น ๆ', 'Other'), icon: 'lucideShapes', color: '#475569' },
  ],
  income: [
    { key: 'salary', name: t('เงินเดือน', 'Salary'), icon: 'tpnPayslip', color: '#15803d' },
    { name: t('โบนัส', 'Bonus'), icon: 'lucideAward', color: '#a16207' },
    {
      name: t('ดอกเบี้ยและเงินปันผล', 'Interest & dividends'),
      icon: 'lucideChartLine',
      color: '#0f766e',
    },
    { key: 'sales', name: t('ขายของ', 'Sales'), icon: 'lucideStore', color: '#c2410c' },
    { name: t('ได้รับเงิน', 'Money received'), icon: 'lucideHandCoins', color: '#2563eb' },
    { key: 'otherIncome', name: t('อื่น ๆ', 'Other'), icon: 'lucideShapes', color: '#475569' },
  ],
}

type WalletKey = 'cash' | 'bank' | 'card' | 'savings' | 'yen'

/** Amounts in minor units: THB has 2 digits, JPY none. */
const baht = (amount: number) => amount * 100
const yen = (amount: number) => amount

const WALLETS: {
  key: WalletKey
  name: Text
  currencyCode: string
  initialBalance: number
  icon: string
  color: string
  excludeFromTotal: boolean
  isCreditCard: boolean
}[] = [
  {
    key: 'cash',
    name: t('เงินสด', 'Cash'),
    currencyCode: 'THB',
    initialBalance: baht(2_500),
    icon: 'lucideBanknote',
    color: '#15803d',
    excludeFromTotal: false,
    isCreditCard: false,
  },
  {
    key: 'bank',
    name: t('บัญชีธนาคาร', 'Bank account'),
    currencyCode: 'THB',
    // Enough that the bank never goes below 0, whatever day of the month the demo starts.
    initialBalance: baht(80_000),
    icon: 'lucideLandmark',
    color: '#2563eb',
    excludeFromTotal: false,
    isCreditCard: false,
  },
  {
    key: 'card',
    name: t('บัตรเครดิต', 'Credit card'),
    currencyCode: 'THB',
    // Owed from the statement before the data starts; paid at D-78.
    initialBalance: -baht(6_800),
    icon: 'lucideCreditCard',
    color: '#9333ea',
    excludeFromTotal: true,
    isCreditCard: true,
  },
  {
    key: 'savings',
    name: t('เงินออม', 'Savings'),
    currencyCode: 'THB',
    initialBalance: baht(60_000),
    icon: 'lucidePiggyBank',
    color: '#db2777',
    excludeFromTotal: true,
    isCreditCard: false,
  },
  {
    key: 'yen',
    name: t('เงินเยน', 'Yen'),
    currencyCode: 'JPY',
    initialBalance: 0,
    icon: 'lucideBanknote',
    color: '#dc2626',
    excludeFromTotal: false,
    isCreditCard: false,
  },
]

interface Spend {
  name: Text
  category: CategoryKey
  wallet: WalletKey
  /** One amount, or four picked by `k mod 4` (k = days before D). */
  amounts: number[]
  /** Which days of the week (0 = Sunday). */
  days: number[]
  /** Only in weeks where `w mod n` = `r` (w = whole weeks before D). */
  weeks?: { n: number; r: number }
}

const WEEKDAYS = [1, 2, 3, 4, 5]

/** Everyday spending in Bangkok, by day of the week (not during the trip). */
const EVERYDAY: Spend[] = [
  {
    name: NO_NOTE,
    category: 'drinks',
    wallet: 'cash',
    amounts: [55, 65, 60, 75],
    days: WEEKDAYS,
  },
  {
    name: t('ข้าวกลางวัน', 'Lunch'),
    category: 'meals',
    wallet: 'cash',
    amounts: [60, 75, 65, 80],
    days: WEEKDAYS,
  },
  {
    name: t('ไป-กลับที่ทำงาน', 'To work and back'),
    category: 'metro',
    wallet: 'bank',
    amounts: [74],
    days: WEEKDAYS,
  },
  {
    name: t('ข้าวเย็น', 'Dinner'),
    category: 'meals',
    wallet: 'cash',
    amounts: [50, 70, 85, 60],
    days: [1, 2, 3, 4],
  },
  {
    name: t('ร้านสะดวกซื้อ', 'Convenience store'),
    category: 'meals',
    wallet: 'cash',
    amounts: [45, 89, 120, 65],
    days: [2, 4],
  },
  {
    name: t('ข้าวเย็นกับเพื่อน', 'Dinner with friends'),
    category: 'food',
    wallet: 'card',
    amounts: [350, 420, 280, 520],
    days: [5],
  },
  {
    name: t('ซื้อของเข้าบ้าน', 'Groceries'),
    category: 'food',
    wallet: 'card',
    amounts: [650, 820, 540, 710],
    days: [6],
  },
  {
    name: NO_NOTE,
    category: 'taxi',
    wallet: 'bank',
    amounts: [120, 180, 120, 180],
    days: [6],
    weeks: { n: 2, r: 0 },
  },
  {
    name: t('มื้อสาย', 'Brunch'),
    category: 'food',
    wallet: 'cash',
    amounts: [240, 180, 320, 260],
    days: [0],
  },
  {
    name: t('ดูหนัง', 'Movie'),
    category: 'entertainment',
    wallet: 'card',
    amounts: [280],
    days: [0],
    weeks: { n: 4, r: 1 },
  },
  {
    name: t('ซื้อเสื้อผ้า', 'Clothes'),
    category: 'shopping',
    wallet: 'card',
    amounts: [890],
    days: [0],
    weeks: { n: 4, r: 3 },
  },
]

/** Every Monday (not during the trip): cash from the bank. */
const CASH_WITHDRAWAL = { name: t('ถอนเงินสด', 'Cash withdrawal'), amount: 1_500, day: 1 }

interface Monthly {
  name: Text
  category: CategoryKey
  wallet: WalletKey
  /** Oldest first; the last one repeats. */
  amounts: number[]
  day: number
}

/** Once a month, on that day (rent and the subscription are recurring rules, below). */
const MONTHLY: Monthly[] = [
  {
    name: NO_NOTE,
    category: 'internet',
    wallet: 'bank',
    amounts: [599],
    day: 3,
  },
  {
    name: t('ค่าโทรศัพท์รายเดือน', 'Phone plan'),
    category: 'internet',
    wallet: 'bank',
    amounts: [499],
    day: 5,
  },
  {
    name: t('ค่าฟิตเนส', 'Gym membership'),
    category: 'health',
    wallet: 'card',
    amounts: [990],
    day: 8,
  },
  {
    name: NO_NOTE,
    category: 'electricity',
    wallet: 'bank',
    amounts: [1_150, 1_380, 1_240],
    day: 10,
  },
  {
    name: NO_NOTE,
    category: 'water',
    wallet: 'bank',
    amounts: [165, 190, 180],
    day: 10,
  },
  {
    name: t('ส่งเงินให้แม่', 'Money for Mom'),
    category: 'family',
    wallet: 'bank',
    amounts: [3_000],
    day: 20,
  },
  {
    name: NO_NOTE,
    category: 'salary',
    wallet: 'bank',
    amounts: [34_250],
    day: 25,
  },
]

const MONTHLY_SAVING = { name: t('ออมเงิน', 'Monthly saving'), amount: 5_000, day: 26 }

const RENT = { name: NO_NOTE, amount: 7_500, day: 1 }
const SUBSCRIPTION = { name: t('ค่าสมาชิกสตรีมมิ่ง', 'Streaming subscription'), amount: 419 }

interface OneOff {
  daysAgo: number
  name: Text
  category: CategoryKey
  wallet: WalletKey
  amount: number
  trip?: boolean
  excludeFromReport?: boolean
}

const ONE_OFFS: OneOff[] = [
  {
    daysAgo: 75,
    name: t('คอร์สออนไลน์', 'Online course'),
    category: 'education',
    wallet: 'card',
    amount: 1_290,
  },
  {
    daysAgo: 70,
    name: t('ตั๋วเครื่องบิน กรุงเทพ–โอซาก้า', 'Flights Bangkok–Osaka'),
    category: 'travel',
    wallet: 'card',
    amount: 14_900,
    trip: true,
  },
  {
    daysAgo: 65,
    name: t('ที่พักโอซาก้า 5 คืน', 'Osaka hotel, 5 nights'),
    category: 'travel',
    wallet: 'card',
    amount: 9_600,
    trip: true,
  },
  {
    daysAgo: 58,
    name: t('ร้านขายยา', 'Pharmacy'),
    category: 'health',
    wallet: 'cash',
    amount: 185,
  },
  {
    daysAgo: 42,
    name: t('ประกันเดินทาง', 'Travel insurance'),
    category: 'insurance',
    wallet: 'card',
    amount: 450,
    trip: true,
  },
  // The yen came from the bank: both sides out of the reports, so the trip counts once.
  {
    daysAgo: 42,
    name: t('แลกเงินเยน', 'Exchanged to yen'),
    category: 'travel',
    wallet: 'bank',
    amount: 13_500,
    excludeFromReport: true,
  },
  {
    daysAgo: 40,
    name: t('แท็กซี่ไปสนามบิน', 'Taxi to the airport'),
    category: 'taxi',
    wallet: 'bank',
    amount: 450,
    trip: true,
  },
  {
    daysAgo: 35,
    name: t('แท็กซี่กลับจากสนามบิน', 'Taxi home'),
    category: 'taxi',
    wallet: 'bank',
    amount: 480,
    trip: true,
  },
  {
    daysAgo: 30,
    name: t('ตัดผม', 'Haircut'),
    category: 'otherExpense',
    wallet: 'cash',
    amount: 250,
  },
  {
    daysAgo: 15,
    name: t('ของขวัญวันเกิดเพื่อน', "Friend's birthday gift"),
    category: 'gifts',
    wallet: 'card',
    amount: 800,
  },
  {
    daysAgo: 12,
    name: t('ขายหูฟังเก่า', 'Sold old headphones'),
    category: 'sales',
    wallet: 'bank',
    amount: 1_500,
  },
]

const YEN_IN = {
  daysAgo: 42,
  name: t('แลกเงินเยน', 'Exchanged from baht'),
  amount: 60_000,
}

/** Paid from the bank, sized to what the card spent before each. */
const CARD_PAYMENTS = [
  { daysAgo: 78, amount: 6_800 },
  { daysAgo: 48, amount: 31_500 },
  { daysAgo: 18, amount: 7_200 },
]
const CARD_PAYMENT_NAME = t('จ่ายบัตรเครดิต', 'Credit card payment')

const TRIP = {
  name: t('ทริปญี่ปุ่น', 'Japan trip'),
  icon: 'lucidePlane',
  color: '#0e7490',
  startDaysAgo: 40,
  endDaysAgo: 35,
}

/** Spent in Japan from the yen wallet, tagged to the trip. */
const TRIP_SPENDING: { daysAgo: number; name: Text; category: CategoryKey; amount: number }[] = [
  {
    daysAgo: 40,
    name: t('บัตรรถไฟ IC', 'IC train card'),
    category: 'publicTransport',
    amount: 3_000,
  },
  { daysAgo: 40, name: t('ราเมง', 'Ramen'), category: 'meals', amount: 1_200 },
  {
    daysAgo: 39,
    name: t('ค่าเข้าชมปราสาท', 'Castle admission'),
    category: 'travel',
    amount: 1_000,
  },
  { daysAgo: 39, name: t('ซูชิ', 'Sushi'), category: 'food', amount: 3_200 },
  { daysAgo: 39, name: t('ชาเขียวมัทฉะ', 'Matcha latte'), category: 'drinks', amount: 550 },
  { daysAgo: 38, name: t('สวนสนุก', 'Theme park'), category: 'entertainment', amount: 8_900 },
  { daysAgo: 38, name: t('อาหารในสวนสนุก', 'Theme park food'), category: 'food', amount: 1_800 },
  {
    daysAgo: 37,
    name: t('รถไฟไปเกียวโต', 'Train to Kyoto'),
    category: 'publicTransport',
    amount: 1_160,
  },
  { daysAgo: 37, name: t('เช่ากิโมโน', 'Kimono rental'), category: 'travel', amount: 4_000 },
  { daysAgo: 37, name: t('ข้าวหน้าเนื้อ', 'Beef bowl'), category: 'meals', amount: 980 },
  { daysAgo: 36, name: t('ของฝาก', 'Souvenirs'), category: 'shopping', amount: 6_500 },
  { daysAgo: 36, name: t('ร้านสะดวกซื้อ', 'Convenience store'), category: 'meals', amount: 680 },
  { daysAgo: 36, name: t('ทาโกะยากิ', 'Takoyaki'), category: 'meals', amount: 600 },
  { daysAgo: 35, name: t('ร้านปลอดภาษี', 'Duty-free shop'), category: 'shopping', amount: 5_200 },
  {
    daysAgo: 35,
    name: t('รถไฟไปสนามบิน', 'Airport train'),
    category: 'publicTransport',
    amount: 1_300,
  },
]

const DEBT = {
  person: t('เพื่อนร่วมงาน', 'Coworker'),
  note: t('ค่ามัดจำห้อง', 'Room deposit'),
  dueInDays: 30,
  lent: { daysAgo: 50, amount: 5_000, note: t('ให้ยืม', 'Lent') },
  repaid: { daysAgo: 20, amount: 2_000, note: t('คืนบางส่วน', 'Partly paid back') },
}

const BOOK = { name: t('ส่วนตัว', 'Personal'), icon: 'lucideWallet', color: '#0f766e' }

// ───────────────────────────── Building it ───────────────────────────────────────────────────────

export interface DemoSeedInput {
  lang: DemoLanguage
  /** The day the demo starts, `YYYY-MM-DD` in the user's time zone (rule 7). */
  today: string
  /** When it is created (epoch ms): no `createdAt` goes past it. */
  now: number
  /** UUIDv7 by default; tests pass a counter. */
  newId?: () => string
}

/** Rule 6: one book with its wallets, categories, ~3 months of money, rules, a debt and a trip. */
export const buildDemoSeed = ({ lang, today, now, newId = uuidv7 }: DemoSeedInput): DemoSeed => {
  const text = (value: Text) => (lang === 'en' ? value.en : value.th)
  const daysAgo = (days: number) => addDays(today, -days)
  // The data covers the days after "the same date 3 months ago", up to today.
  const windowStart = addMonths(today, -3)
  const inWindow = (day: string) => day > windowStart && day <= today
  const tripStart = daysAgo(TRIP.startDaysAgo)
  const tripEnd = daysAgo(TRIP.endDaysAgo)
  const inTrip = (day: string) => day >= tripStart && day <= tripEnd

  // A day's rows get increasing times from 08:00 (Bangkok), never after `now`.
  const order = new Map<string, number>()
  const stamp = (day: string): number => {
    const index = order.get(day) ?? 0
    order.set(day, index + 1)
    return Math.min(toUtc(day) + (1 + index * 0.25) * 3_600_000, now)
  }

  const book: DemoBook = {
    id: newId(),
    name: text(BOOK.name),
    icon: BOOK.icon,
    color: BOOK.color,
    sortOrder: 0,
  }
  const bookId = book.id

  const wallets: DemoWallet[] = []
  const walletIds = new Map<WalletKey, string>()
  WALLETS.forEach((wallet, index) => {
    const id = newId()
    walletIds.set(wallet.key, id)
    wallets.push({
      id,
      bookId,
      name: text(wallet.name),
      currencyCode: wallet.currencyCode,
      initialBalance: wallet.initialBalance,
      icon: wallet.icon,
      color: wallet.color,
      excludeFromTotal: wallet.excludeFromTotal,
      isCreditCard: wallet.isCreditCard,
      isArchived: false,
      sortOrder: index,
      hiddenCategoryIds: [],
    })
  })
  const walletId = (key: WalletKey) => walletIds.get(key) ?? ''

  const categories: DemoCategory[] = []
  const categoryIds = new Map<CategoryKey, string>()
  const sets = [
    ['expense', CATEGORIES.expense],
    ['income', CATEGORIES.income],
  ] as const
  for (const [type, set] of sets) {
    set.forEach((parent, index) => {
      const add = (item: CategorySeed, parentId: string | null, sortOrder: number) => {
        const id = newId()
        if (item.key) {
          categoryIds.set(item.key, id)
        }
        categories.push({
          id,
          bookId,
          type,
          parentId,
          name: text(item.name),
          icon: item.icon,
          color: item.color,
          isArchived: false,
          sortOrder,
        })
        return id
      }
      const parentId = add(parent, null, index)
      parent.children?.forEach((child, childIndex) => add(child, parentId, childIndex))
    })
  }
  const categoryId = (key: CategoryKey) => categoryIds.get(key) ?? ''

  const event: DemoEvent = {
    id: newId(),
    bookId,
    name: text(TRIP.name),
    icon: TRIP.icon,
    color: TRIP.color,
    startOn: tripStart,
    endOn: tripEnd,
  }

  const transactions: DemoTransaction[] = []
  const transfers: DemoTransfer[] = []
  const spend = (
    day: string,
    name: Text,
    category: CategoryKey,
    wallet: WalletKey,
    amount: number,
    extra: Partial<
      Pick<DemoTransaction, 'id' | 'excludeFromReport' | 'recurringId' | 'eventId'>
    > = {}
  ) => {
    transactions.push({
      id: extra.id ?? newId(),
      bookId,
      walletId: walletId(wallet),
      categoryId: categoryId(category),
      amount,
      occurredOn: day,
      note: text(name),
      excludeFromReport: extra.excludeFromReport ?? false,
      recurringId: extra.recurringId ?? null,
      eventId: extra.eventId ?? null,
      createdAt: stamp(day),
    })
  }
  const transfer = (day: string, name: Text, from: WalletKey, to: WalletKey, amount: number) => {
    transfers.push({
      id: newId(),
      bookId,
      fromWalletId: walletId(from),
      toWalletId: walletId(to),
      amount,
      occurredOn: day,
      note: text(name),
      createdAt: stamp(day),
    })
  }
  /** The day-`day` dates of the months in the window, oldest first. */
  const monthlyDays = (day: number) =>
    [-3, -2, -1, 0].map((months) => monthDay(today, months, day)).filter(inWindow)

  // Recurring rules (rule 6): rent recorded by itself, the subscription asking first.
  const rentDays = monthlyDays(RENT.day)
  const rent: DemoRecurringRule = {
    id: newId(),
    bookId,
    walletId: walletId('bank'),
    categoryId: categoryId('rent'),
    amount: baht(RENT.amount),
    note: text(RENT.name),
    startOn: rentDays[0],
    confirm: false,
    // The first occurrence after today, so the device's pass finds nothing missing.
    nextOn: monthDay(rentDays[0], rentDays.length, RENT.day),
  }
  const subscriptionStart = addMonths(today, -2)
  const subscription: DemoRecurringRule = {
    id: newId(),
    bookId,
    walletId: walletId('card'),
    categoryId: categoryId('entertainment'),
    amount: baht(SUBSCRIPTION.amount),
    note: text(SUBSCRIPTION.name),
    startOn: subscriptionStart,
    confirm: true,
    // Today's occurrence (or the closest before it) waits for the user: the due card shows.
    nextOn: monthDay(subscriptionStart, 2, dayOfMonth(subscriptionStart)),
  }

  const addRecurring = (day: string) => {
    if (rentDays.includes(day)) {
      spend(day, RENT.name, 'rent', 'bank', baht(RENT.amount), {
        id: occurrenceId(rent.id, day),
        recurringId: rent.id,
      })
    }
    // The two occurrences before today's (rule 6: today's waits on the due card).
    const recorded = [0, 1].map((k) =>
      monthDay(subscriptionStart, k, dayOfMonth(subscriptionStart))
    )
    if (recorded.includes(day)) {
      spend(day, SUBSCRIPTION.name, 'entertainment', 'card', baht(SUBSCRIPTION.amount), {
        id: occurrenceId(subscription.id, day),
        recurringId: subscription.id,
      })
    }
  }

  const addMonthly = (day: string) => {
    for (const item of MONTHLY) {
      const index = monthlyDays(item.day).indexOf(day)
      if (index >= 0) {
        const amount = item.amounts.at(Math.min(index, item.amounts.length - 1)) ?? 0
        spend(day, item.name, item.category, item.wallet, baht(amount))
      }
    }
    if (monthlyDays(MONTHLY_SAVING.day).includes(day)) {
      transfer(day, MONTHLY_SAVING.name, 'bank', 'savings', baht(MONTHLY_SAVING.amount))
    }
  }

  /** Day-to-day life in Bangkok (none while away on the trip). */
  const addEveryday = (day: string, k: number) => {
    if (inTrip(day)) {
      return
    }
    const week = Math.floor(k / 7)
    const dow = weekday(day)
    if (dow === CASH_WITHDRAWAL.day) {
      transfer(day, CASH_WITHDRAWAL.name, 'bank', 'cash', baht(CASH_WITHDRAWAL.amount))
    }
    const items = EVERYDAY.filter(
      (item) => item.days.includes(dow) && (!item.weeks || week % item.weeks.n === item.weeks.r)
    )
    for (const item of items) {
      const amount = item.amounts.at(k % item.amounts.length) ?? 0
      spend(day, item.name, item.category, item.wallet, baht(amount))
    }
  }

  /** The rows fixed to "k days ago": card payments, one-offs, the yen and the trip. */
  const addDated = (day: string, k: number) => {
    for (const payment of CARD_PAYMENTS.filter((item) => item.daysAgo === k)) {
      transfer(day, CARD_PAYMENT_NAME, 'bank', 'card', baht(payment.amount))
    }
    for (const item of ONE_OFFS.filter((one) => one.daysAgo === k)) {
      spend(day, item.name, item.category, item.wallet, baht(item.amount), {
        excludeFromReport: item.excludeFromReport ?? false,
        eventId: item.trip ? event.id : null,
      })
    }
    if (YEN_IN.daysAgo === k) {
      spend(day, YEN_IN.name, 'otherIncome', 'yen', yen(YEN_IN.amount), { excludeFromReport: true })
    }
    for (const item of TRIP_SPENDING.filter((spent) => spent.daysAgo === k)) {
      spend(day, item.name, item.category, 'yen', yen(item.amount), { eventId: event.id })
    }
  }

  // Oldest first, so a day's rows come in a natural order.
  for (let k = Math.round((toUtc(today) - toUtc(windowStart)) / DAY_MS) - 1; k >= 0; k--) {
    const day = daysAgo(k)
    addRecurring(day)
    addMonthly(day)
    addEveryday(day, k)
    addDated(day, k)
  }

  const debt: DemoDebt = {
    id: newId(),
    bookId,
    person: text(DEBT.person),
    note: text(DEBT.note),
    currencyCode: 'THB',
    dueOn: addDays(today, DEBT.dueInDays),
  }
  const entry = (
    kind: DemoDebtEntry['kind'],
    { daysAgo: ago, amount, note }: { daysAgo: number; amount: number; note: Text }
  ): DemoDebtEntry => {
    const day = daysAgo(ago)
    return {
      id: newId(),
      bookId,
      debtId: debt.id,
      kind,
      walletId: walletId('bank'),
      amount: baht(amount),
      occurredOn: day,
      note: text(note),
      createdAt: stamp(day),
    }
  }

  return {
    book,
    wallets,
    categories,
    transactions,
    transfers,
    recurringRules: [rent, subscription],
    debts: [debt],
    debtEntries: [entry('principal', DEBT.lent), entry('repayment', DEBT.repaid)],
    events: [event],
  }
}
