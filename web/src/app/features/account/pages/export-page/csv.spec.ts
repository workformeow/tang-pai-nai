import { csvField, csvText, exportFileName, toCsv } from './csv'

describe('csv', () => {
  it('quotes a field with a comma, a quote or a line break, doubling quotes (RFC 4180)', () => {
    expect(csvField('ข้าวมันไก่')).toBe('ข้าวมันไก่')
    expect(csvField('ข้าว, ไข่')).toBe('"ข้าว, ไข่"')
    expect(csvField('ร้าน "ป้า"')).toBe('"ร้าน ""ป้า"""')
    expect(csvField('สอง\nบรรทัด')).toBe('"สอง\nบรรทัด"')
  })

  it("puts ' before text a spreadsheet would run as a formula (export rule 6)", () => {
    for (const start of ['=', '+', '-', '@']) {
      expect(csvText(`${start}SUM(A1)`)).toBe(`'${start}SUM(A1)`)
    }
    expect(csvText('กาแฟ = 65')).toBe('กาแฟ = 65')
  })

  it('writes a BOM, commas and CRLF line ends (rule 5)', () => {
    expect(
      toCsv([
        ['a', 'b'],
        ['1', 'x,y'],
      ])
    ).toBe('﻿a,b\r\n1,"x,y"\r\n')
  })

  it('keeps an ASCII book name in the file name and leaves a Thai one out (rule 5)', () => {
    expect(exportFileName('Home budget', '2026-11-09')).toBe(
      'tangpainai-Home-budget-2026-11-09.csv'
    )
    expect(exportFileName('ครอบครัว', '2026-11-09')).toBe('tangpainai-2026-11-09.csv')
    expect(exportFileName('บ้าน / Home', '2026-11-09')).toBe('tangpainai-Home-2026-11-09.csv')
  })
})

describe('doc examples (csv.ts)', () => {
  it('match the e.g. lines', () => {
    expect(csvText('=1+1')).toBe("'=1+1")
    expect(csvText('-50')).toBe("'-50")
    expect(csvText('ข้าวเย็น')).toBe('ข้าวเย็น')
    expect(csvField('a,b')).toBe('"a,b"')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField('plain')).toBe('plain')
    expect(
      toCsv([
        ['a', 'b,c'],
        ['1', '2'],
      ])
    ).toBe('﻿a,"b,c"\r\n1,2\r\n')
    expect(exportFileName('My Book 2026', '2026-11-18')).toBe(
      'tangpainai-My-Book-2026-2026-11-18.csv'
    )
    expect(exportFileName('ส่วนตัว', '2026-11-18')).toBe('tangpainai-2026-11-18.csv')
  })
})
