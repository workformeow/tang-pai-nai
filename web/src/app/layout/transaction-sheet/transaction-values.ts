import type { RepeatValues, RuleValues } from '@/core/recurring'
import type { TransactionValues } from '@/core/transaction'
import { toMajorText } from '@/shared/utils'

/** Minor units as the amount field's text: plain digits (no `,`), blank for nothing. */
export const amountText = (minor: number, minorUnit: number): string =>
  minor > 0 ? toMajorText(minor, minorUnit).replace(/,/g, '') : ''

/** A recurring rule from the sheet's values and its "ทำซ้ำ" schedule (recurring.md). */
export const toRuleValues = (repeat: RepeatValues, values: TransactionValues): RuleValues => ({
  ...repeat,
  kind: 'transaction',
  walletId: values.walletId,
  categoryId: values.categoryId,
  toWalletId: null,
  amount: values.amount,
  note: values.note,
  excludeFromReport: values.excludeFromReport,
  debtId: values.debtId,
  startOn: values.occurredOn,
})
