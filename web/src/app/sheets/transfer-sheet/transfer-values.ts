import type { RepeatValues, RuleValues } from '@/core/recurring'
import type { TransferValues } from '@/core/transaction'

/** A recurring rule from the sheet's values and its "ทำซ้ำ" schedule (recurring.md Q4). */
export const toRuleValues = (repeat: RepeatValues, values: TransferValues): RuleValues => ({
  ...repeat,
  kind: 'transfer',
  walletId: values.fromWalletId,
  categoryId: null,
  toWalletId: values.toWalletId,
  amount: values.amount,
  note: values.note,
  excludeFromReport: false,
  startOn: values.occurredOn,
})
