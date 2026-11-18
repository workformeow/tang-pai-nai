import { signal } from '@angular/core'
import { keepWhileClosing } from './keep-while-closing'

describe('keepWhileClosing', () => {
  it('follows the open state and keeps the last one while closed', () => {
    const source = signal<{ id: string } | null>(null)
    const state = keepWhileClosing(source)
    expect(state()).toBeNull()
    source.set({ id: 'a' })
    expect(state()).toEqual({ id: 'a' })
    source.set(null)
    expect(state()).toEqual({ id: 'a' })
    source.set({ id: 'b' })
    expect(state()).toEqual({ id: 'b' })
  })
})
