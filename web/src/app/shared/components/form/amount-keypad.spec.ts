import { FormControl } from '@angular/forms'
import { AmountKeypad } from './amount-keypad'

describe('AmountKeypad', () => {
  const setup = (value = '', minorUnit = 2) => {
    const control = new FormControl(value, { nonNullable: true })
    const keypad = new AmountKeypad(control, () => minorUnit)
    keypad.open.set(true)
    return { control, keypad }
  }
  const inForm = (html: string) => {
    const form = document.createElement('form')
    form.innerHTML = html
    document.body.append(form)
    return form
  }

  afterEach(() => document.body.replaceChildren())

  it('types keys into the control, marks it dirty, and "=" hides the keypad', () => {
    const { control, keypad } = setup()
    keypad.press('1')
    keypad.press('2')
    keypad.press('000')
    expect(control.value).toBe('12000')
    expect(control.dirty).toBe(true)
    keypad.press('=')
    expect(keypad.open()).toBe(false)
    expect(control.value).toBe('12000')
  })

  it('adds a quick amount to what is there', () => {
    const { control, keypad } = setup('500')
    keypad.addQuick(100)
    expect(control.value).toBe('600')
    expect(control.dirty).toBe(true)
  })

  it('hides on a tap on another control, but not on blank space or the amount row', () => {
    const form = inForm(
      '<app-calc-amount-field><button id="amount"></button></app-calc-amount-field>' +
        '<div id="blank"></div><button id="other"></button>'
    )
    const { keypad } = setup()
    const tap = (id: string) => ({ target: form.querySelector(`#${id}`) }) as unknown as Event
    keypad.leave(tap('amount'))
    keypad.leave(tap('blank'))
    expect(keypad.open()).toBe(true)
    keypad.leave(tap('other'))
    expect(keypad.open()).toBe(false)
  })

  it('takes a hardware keyboard while open and the form shows, not from an input', () => {
    const { control, keypad } = setup()
    const key = (keyName: string, target: EventTarget = document.body) => {
      const event = new KeyboardEvent('keydown', { key: keyName, cancelable: true })
      Object.defineProperty(event, 'target', { value: target })
      return event
    }
    const seven = key('7')
    keypad.onKey(seven, true)
    expect(control.value).toBe('7')
    expect(seven.defaultPrevented).toBe(true)
    keypad.onKey(key('8'), false)
    keypad.onKey(key('9', document.createElement('input')), true)
    expect(control.value).toBe('7')
    keypad.onKey(key('Enter'), true)
    expect(keypad.open()).toBe(false)
  })
})
