import { Component, inject } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { NonNullableFormBuilder } from '@angular/forms'
import { ToggleListField } from './toggle-list-field'
import type { ToggleListItem } from './toggle-list-field'

const item = (id: string): ToggleListItem => ({
  id,
  label: id,
  icon: 'lucideWallet',
  color: '#2563eb',
  fallback: 'lucideWallet',
})

@Component({
  imports: [ToggleListField],
  template: `<app-toggle-list-field [control]="control" label="Wallets" [items]="items" />`,
})
class Host {
  control = inject(NonNullableFormBuilder).control<string[]>(['b'])
  items = [item('a'), item('b')]
}

describe('ToggleListField', () => {
  const setup = async () => {
    const fixture = TestBed.createComponent(Host)
    await fixture.whenStable()
    const element = fixture.nativeElement as HTMLElement
    const checked = () =>
      [...element.querySelectorAll('[role="switch"]')].map((row) =>
        row.getAttribute('aria-checked')
      )
    return { fixture, element, checked }
  }

  it('shows the ids in the control as off', async () => {
    const { checked } = await setup()
    expect(checked()).toEqual(['true', 'false'])
  })

  it('toggles a row when it is tapped', async () => {
    const { fixture, element, checked } = await setup()
    ;(element.querySelector('[role="switch"]') as HTMLElement).click()
    await fixture.whenStable()
    expect(checked()).toEqual(['false', 'false'])
    expect(fixture.componentInstance.control.value).toEqual(['b', 'a'])
  })

  // The share sheet's "เลือกทั้งหมด" / "ล้างที่เลือก" sets the control from outside.
  it('follows a value set from outside', async () => {
    const { fixture, checked } = await setup()
    fixture.componentInstance.control.setValue(['a', 'b'])
    await fixture.whenStable()
    expect(checked()).toEqual(['false', 'false'])
    fixture.componentInstance.control.setValue([])
    await fixture.whenStable()
    expect(checked()).toEqual(['true', 'true'])
  })
})

@Component({
  imports: [ToggleListField],
  template: `<app-toggle-list-field
    [control]="control"
    label="Categories"
    [items]="items"
    allLabel="Use every category"
    allNote="note"
  />`,
})
class MasterHost {
  control = inject(NonNullableFormBuilder).control<string[]>([])
  items: ToggleListItem[] = [item('p'), { ...item('c'), child: true }, item('q')]
}

describe('ToggleListField master switch', () => {
  const setup = async (off: string[], items?: ToggleListItem[]) => {
    const fixture = TestBed.createComponent(MasterHost)
    fixture.componentInstance.control.setValue(off)
    if (items) {
      fixture.componentInstance.items = items
    }
    await fixture.whenStable()
    const element = fixture.nativeElement as HTMLElement
    const master = () => element.querySelector('[role="switch"]') as HTMLButtonElement
    const click = async () => {
      master().click()
      await fixture.whenStable()
    }
    return { fixture, master, click, value: () => fixture.componentInstance.control.value }
  }

  it('is on only while every row is on', async () => {
    const { master } = await setup(['c'])
    expect(master().getAttribute('aria-checked')).toBe('false')
    expect(master().textContent).toContain('Use every category')
    expect(master().textContent).toContain('note')
  })

  it('turns every row on, then the top-level rows off (a parent takes its children)', async () => {
    const { master, click, value } = await setup(['c'])
    await click()
    expect(value()).toEqual([])
    expect(master().getAttribute('aria-checked')).toBe('true')
    await click()
    expect(value()).toEqual(['p', 'q'])
  })

  it('leaves a locked row alone, but turns on a child locked by its parent here', async () => {
    const locked = (id: string, child = false): ToggleListItem => ({
      ...item(id),
      child,
      lockedNote: 'locked',
    })
    const { master, click, value } = await setup(
      ['p', 'c', 'l'],
      [item('p'), locked('c', true), locked('l')]
    )
    await click()
    expect(value()).toEqual(['l'])
    // Every free row is on now, so the switch is on though 'l' stays off.
    expect(master().getAttribute('aria-checked')).toBe('true')
  })

  it('is off and disabled when every row is locked', async () => {
    const { master } = await setup([], [{ ...item('l'), lockedNote: 'locked' }])
    expect(master().disabled).toBe(true)
    expect(master().getAttribute('aria-checked')).toBe('false')
  })
})
