import type { PlanValues } from '@/core/debt'
import { amountText, parseMajor } from '@/shared/utils'

/** The instalment plan as the debt sheet holds it (debt rule 13). */
export interface PlanInput {
  /** How many monthly instalments; 0 = no plan. */
  count: number
  /** The instalment, as typed (major units). */
  amount: string
  /** The first instalment's day. */
  startOn: string
  /** Ask before recording each one, or record by itself. */
  confirm: boolean
  walletId: string | null
}

/**
 * Debt rule 13: the plan as a monthly recurring rule, or null when there is none (no count, no
 * amount or no wallet).
 */
export const toPlanValues = (plan: PlanInput, minorUnit: number): PlanValues | null => {
  const amount = parseMajor(plan.amount || '0', minorUnit)
  if (plan.count <= 0 || !amount.ok || amount.minor <= 0 || !plan.walletId) {
    return null
  }
  return {
    repeat: {
      frequency: 'month',
      interval: 1,
      endOn: null,
      endCount: plan.count,
      confirm: plan.confirm,
    },
    startOn: plan.startOn,
    amount: amount.minor,
    walletId: plan.walletId,
  }
}

/** The instalment a plan starts with: the total split evenly over `count`, rounded up. */
export const evenInstalment = (totalMinor: number, count: number, minorUnit: number): string =>
  amountText(Math.ceil(totalMinor / count), minorUnit)
