import { ACTIVITY_MS, activityDaysLeft, activityLeftText, latestAction } from './activity'

describe('latestAction (shared-activity rule 4)', () => {
  const row = { addedBy: null, updatedBy: 'u1', createdAt: 1000, updatedAt: 1000, deletedAt: null }

  it('reads an untouched row, or one edited within a minute, as the add by its adder', () => {
    expect(latestAction({ ...row, addedBy: 'm1' }, 'owner', 'me')).toEqual({
      action: 'added',
      actor: 'm1',
    })
    expect(latestAction({ ...row, updatedAt: 61_000 }, 'owner', 'me')).toEqual({
      action: 'added',
      actor: 'owner',
    })
  })

  it('reads a later change as an edit and a tombstone as a delete, both by updatedBy', () => {
    expect(latestAction({ ...row, updatedAt: 61_001, updatedBy: 'm1' }, 'owner', 'me')).toEqual({
      action: 'edited',
      actor: 'm1',
    })
    expect(latestAction({ ...row, deletedAt: 1000, updatedBy: 'm1' }, 'owner', 'me')).toEqual({
      action: 'deleted',
      actor: 'm1',
    })
  })

  it('has no actor for my own action, a row only this device has, or a pending one', () => {
    expect(latestAction({ ...row, addedBy: 'me' }, 'owner', 'me').actor).toBeNull()
    expect(
      latestAction({ ...row, updatedAt: 99_000, updatedBy: null }, 'owner', 'me').actor
    ).toBeNull()
    expect(latestAction({ ...row, addedBy: 'm1' }, 'owner', 'me', true).actor).toBeNull()
  })
})

describe('days left of an ended share (shared-activity rule 7)', () => {
  const t = (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${String(params['count'])}` : key

  it('counts whole days up, the last one as 1, and none without a date', () => {
    const now = 1_000_000
    expect(activityDaysLeft(null, now)).toBeNull()
    expect(activityDaysLeft(now + ACTIVITY_MS, now)).toBe(90)
    expect(activityDaysLeft(now + 4.5 * 86_400_000, now)).toBe(5)
    expect(activityDaysLeft(now + 1000, now)).toBe(1)
    expect(activityDaysLeft(now - 1000, now)).toBe(1)
  })

  it('says "n days left", and "last day" on the last one', () => {
    expect(activityLeftText(5, t)).toBe('activity.daysLeft:5')
    expect(activityLeftText(1, t)).toBe('activity.lastDay')
  })
})
