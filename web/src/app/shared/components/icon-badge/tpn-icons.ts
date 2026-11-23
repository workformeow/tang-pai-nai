/**
 * Our own icons (`tpn`, DESIGN.md §7), drawn where lucide has no clear picture: in lucide's
 * style (24 × 24, 2px round stroke, no fill) so the two mix in one grid. Each says what the thing
 * is at a glance, never a bank's or brand's logo. Registered with `provideIcons` like lucide's,
 * and stored by name, so a shipped icon is never renamed or removed; add new ones at the end.
 */
const svg = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`

/** A baht sign (฿) centred on (12, `cy`), `h` tall. */
const baht = (cy: number, h: number): string => {
  const top = cy - h / 2
  const mid = cy
  const bottom = cy + h / 2
  const left = 12 - h / 3.2
  const bowl = h / 4
  return [
    `<path d="M${left} ${top}h${(12 - left + bowl * 0.4).toFixed(2)}a${bowl} ${bowl} 0 0 1 0 ${h / 2}H${left}"/>`,
    `<path d="M${left} ${mid}h${(12 - left + bowl * 0.7).toFixed(2)}a${bowl} ${bowl} 0 0 1 0 ${h / 2}H${left}"/>`,
    `<path d="M${left} ${top}v${h}"/>`,
    `<path d="M12 ${top - 1.5}v1.5"/>`,
    `<path d="M12 ${bottom}v1.5"/>`,
  ].join('')
}

export const TPN_ICONS = {
  /** A classic bank: roof, two columns and a baht sign between them. */
  tpnBankColumns: svg(
    `<path d="M3 8 12 3l9 5"/><path d="M3 8h18"/><path d="M3 21h18"/><path d="M5.5 11v7"/><path d="M18.5 11v7"/>${baht(14.5, 6)}`
  ),
  /** A modern bank tower with a slanted top. */
  tpnBankTower: svg(
    `<path d="M3 21h18"/><path d="M6 21V8l7-5v18"/><path d="M13 9h5v12"/><path d="M9 9v.01"/><path d="M9 13v.01"/><path d="M9 17v.01"/><path d="M16 13v.01"/><path d="M16 17v.01"/>`
  ),
  /** A bank branch: a striped awning over a door and a window. */
  tpnBankBranch: svg(
    `<path d="M3 9 5 4h14l2 5"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 11.5V21h14v-9.5"/><path d="M14 21v-5h3v5"/><rect x="7" y="14" width="4" height="3" rx="0.5"/>`
  ),
  /** A cash machine handing out a note. */
  tpnAtm: svg(
    `<rect x="3" y="3" width="18" height="12" rx="2"/><path d="M7 7h10"/><path d="M7 11h4"/><path d="M15 11h2"/><path d="M7 15v3"/><path d="M17 15v3"/><path d="M9 15v6h6v-6"/>`
  ),
  /** A bank card with a chip. */
  tpnCardChip: svg(
    `<rect x="2" y="5" width="20" height="14" rx="2"/><rect x="5" y="9" width="5" height="4" rx="1"/><path d="M14 15h4"/>`
  ),
  /** A bank card with contactless waves. */
  tpnCardContactless: svg(
    `<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 15h3"/><path d="M13 10.5a2.5 2.5 0 0 1 0 3"/><path d="M15.5 9a5 5 0 0 1 0 6"/>`
  ),
  /** Two cards, one behind the other. */
  tpnCardsStacked: svg(
    `<path d="M6 5h14a2 2 0 0 1 2 2v8"/><rect x="2" y="9" width="16" height="11" rx="2"/><path d="M2 13h16"/>`
  ),
  /** A coin with a baht sign. */
  tpnBahtCoin: svg(`<circle cx="12" cy="12" r="10"/>${baht(12, 8)}`),
  /** A banknote with a baht sign. */
  tpnBahtNote: svg(
    `<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M5.5 12h.01"/><path d="M18.5 12h.01"/>${baht(12, 6)}`
  ),
  /** A phone showing a QR code (an e-wallet). */
  tpnEwalletQr: svg(
    `<rect x="5" y="2" width="14" height="20" rx="2"/><rect x="8" y="6" width="3" height="3" rx="0.5"/><rect x="13" y="6" width="3" height="3" rx="0.5"/><rect x="8" y="11" width="3" height="3" rx="0.5"/><path d="M13 11h.01"/><path d="M16 11v.01"/><path d="M14.5 12.5v.01"/><path d="M13 14h3"/><path d="M11 18h2"/>`
  ),
  /** A gold bar. */
  tpnGoldBar: svg(
    `<path d="M2 19h20l-3.5-8h-13z"/><path d="M5.5 11 7 7h10l1.5 4"/><path d="M10 15h4"/>`
  ),
  /** A savings jar with a coin inside. */
  tpnSavingsJar: svg(
    `<path d="M8 2h8"/><path d="M9 2v3"/><path d="M15 2v3"/><path d="M8 5h8a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z"/><circle cx="12" cy="15" r="3"/>`
  ),
  /** An envelope with a note sticking out (cash put aside). */
  tpnCashEnvelope: svg(
    `<path d="M6 9V4h12v5"/><path d="M10 6.5h4"/><rect x="2" y="9" width="20" height="12" rx="2"/><path d="m2 11 10 6 10-6"/>`
  ),
  /**
   * A buffet: a chafing dish (domed lid on a pan, on legs, a small flame under it). Redrawn in
   * 7.2; the first drawing lives on as `tpnServingDomes`.
   */
  tpnBuffet: svg(
    `<path d="M12 6.5V8"/><path d="M4 13a8 5 0 0 1 16 0"/><path d="M2.5 13h19"/><path d="M4 13v3h16v-3"/><path d="M6 16v4"/><path d="M18 16v4"/><path d="M12 17.5c-1 1-1 2 0 2.5 1-.5 1-1.5 0-2.5Z"/>`
  ),
  /** Two serving domes on a table (the first buffet drawing, #7). */
  tpnServingDomes: svg(
    `<path d="M2 14h20"/><path d="M3 14a4 4 0 0 1 8 0"/><path d="M13 14a4 4 0 0 1 8 0"/><path d="M7 8.5V10"/><path d="M17 8.5V10"/><path d="M4 14v7"/><path d="M20 14v7"/><path d="M4 18h16"/>`
  ),
  /** A buffet line: a sneeze guard over three covered dishes on a counter (7.2). */
  tpnBuffetLine: svg(
    `<path d="M3 7h18"/><path d="M5 7v6"/><path d="M19 7v6"/><path d="M2 17h20"/><path d="M3.5 17a2.5 2.5 0 0 1 5 0"/><path d="M9.5 17a2.5 2.5 0 0 1 5 0"/><path d="M15.5 17a2.5 2.5 0 0 1 5 0"/><path d="M4 17v4"/><path d="M20 17v4"/>`
  ),
  /** All you can eat: a plate with ∞, a fork and a spoon (7.2). */
  tpnAllYouCanEat: svg(
    `<circle cx="12" cy="12" r="6"/><path d="M9.6 12c0-.9.6-1.4 1.2-1.4.9 0 1.5 1.4 2.4 1.4.6 0 1.2-.5 1.2-1.4"/><path d="M9.6 12c0 .9.6 1.4 1.2 1.4.9 0 1.5-1.4 2.4-1.4.6 0 1.2.5 1.2 1.4"/><path d="M3 3v5a1 1 0 0 0 2 0V3"/><path d="M4 9v12"/><path d="M20 3a1.5 2.5 0 0 0 0 5 1.5 2.5 0 0 0 0-5Z"/><path d="M20 8v13"/>`
  ),
  /** A bubble tea: a domed cup with a straw and pearls. */
  tpnBubbleTea: svg(
    `<path d="M5 9h14"/><path d="M6 9a6 4.5 0 0 1 12 0"/><path d="m6.5 9 1.5 12h8l1.5-12"/><path d="m12 4.5 2-3"/><path d="M10 17h.01"/><path d="M14 17h.01"/><path d="M12 19h.01"/>`
  ),
  /** A noodle bowl with chopsticks. */
  tpnNoodleBowl: svg(
    `<path d="M3 12h18a9 8 0 0 1-18 0Z"/><path d="M9 21h6"/><path d="m11 12 8-9"/><path d="m14 12 7-7"/><path d="M6 9.5c1-1 2 1 3 0"/>`
  ),
  /** A tuk-tuk: a three-wheeler with a canopy. */
  tpnTuktuk: svg(
    `<path d="M3 15V7a1 1 0 0 1 1-1h11l4 6v3"/><path d="M3 11h16"/><path d="M9 6v5"/><circle cx="6" cy="17" r="2"/><circle cx="18" cy="17" r="2"/><path d="M8 17h8"/>`
  ),
  /** A water tap with a drop (the water bill). */
  tpnFaucet: svg(
    `<path d="M10 3h6"/><path d="M13 3v4"/><path d="M4 7h11a4 4 0 0 1 4 4v2"/><path d="M4 11h9a2 2 0 0 1 2 2"/><path d="M4 6v6"/><path d="M17 16s-1.5 1.7-1.5 2.8a1.5 1.5 0 0 0 3 0c0-1.1-1.5-2.8-1.5-2.8z"/>`
  ),
  /** A Thai temple: a spire over two roof tiers (merit and donations). */
  tpnTemple: svg(
    `<path d="M12 2v3"/><path d="m6 10 6-5 6 5"/><path d="m3 15 9-7 9 7"/><path d="M5 13.5V21h14v-7.5"/><path d="M10 21v-4h4v4"/><path d="M3 21h18"/>`
  ),
  /** A payslip with a baht sign (salary). */
  tpnPayslip: svg(
    `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h6"/><path d="M8 7h3"/>${baht(14.5, 6)}`
  ),
  /** A barber's pole (a haircut). */
  tpnBarberPole: svg(
    `<path d="M7 3h10"/><path d="M7 21h10"/><rect x="8" y="5" width="8" height="14" rx="1"/><path d="m8 10 8-3.5"/><path d="m8 14.5 8-3.5"/><path d="m8 19 8-3.5"/>`
  ),
  /** A tooth (the dentist). */
  tpnTooth: svg(
    `<path d="M7.5 3C5 3 3.5 5 3.5 7.5c0 2.3 1.2 3.8 1.6 6C5.6 16.5 6 21 7.8 21c1.6 0 1.9-3.6 2.4-5.2.4-1.2 3.2-1.2 3.6 0 .5 1.6.8 5.2 2.4 5.2 1.8 0 2.2-4.5 2.7-7.5.4-2.2 1.6-3.7 1.6-6C20.5 5 19 3 16.5 3c-1.9 0-2.8 1-4.5 1s-2.6-1-4.5-1z"/>`
  ),
  /** A lipstick (make-up). */
  tpnLipstick: svg(
    `<rect x="8" y="14" width="8" height="7" rx="1"/><path d="M9 14v-3h6v3"/><path d="M10 11V6.5L14 3v8"/>`
  ),
  /** A lotus (massage and spa). */
  tpnSpaLotus: svg(
    `<path d="M12 20c-2.5-1.8-4-4.5-4-7.5 0-2.4 1.6-5 4-7 2.4 2 4 4.6 4 7 0 3-1.5 5.7-4 7.5z"/><path d="M12 20c-4.5 0-8.5-2.5-9.5-6.5 2-.8 4.2-.6 5.8.5"/><path d="M12 20c4.5 0 8.5-2.5 9.5-6.5-2-.8-4.2-.6-5.8.5"/>`
  ),
  /** A scooter with a delivery box (food delivery, ride apps). */
  tpnDeliveryScooter: svg(
    `<circle cx="5.5" cy="17.5" r="2.5"/><circle cx="18.5" cy="17.5" r="2.5"/><path d="M8 17.5h8"/><path d="M18.5 15 16 6h-3"/><path d="M5.5 15H13l1.5-4"/><rect x="2" y="4" width="8" height="7" rx="1"/><path d="M6 4v3"/>`
  ),
  /** A toll booth with its barrier (expressway tolls). */
  tpnTollGate: svg(
    `<path d="M2 21h20"/><path d="M4 21V9l3-3 3 3v12"/><path d="M6 12h2"/><path d="M10 13h11"/><path d="M10 16h11"/><path d="M13 13v3"/><path d="M17 13v3"/>`
  ),
  /** A cooking-gas cylinder. */
  tpnGasCylinder: svg(
    `<path d="M9 2h6"/><path d="M10 2v3"/><path d="M14 2v3"/><rect x="6" y="5" width="12" height="16" rx="4"/><path d="M6 11h12"/><path d="M6 15h12"/>`
  ),
  /** A sneaker (shoes). */
  tpnSneaker: svg(
    `<path d="M2 18h20"/><path d="M2 18V9a1 1 0 0 1 1-1h2.5l2 3.5H11l8 2a3 3 0 0 1 3 3V18"/><path d="M9 11.5v2"/><path d="M12.5 12.3v1.8"/><path d="M7 18v-2"/>`
  ),
  /** A domed grill pan (Thai barbecue, mookata). */
  tpnGrillPan: svg(
    `<path d="M12 5v2"/><path d="M4 14a8 6.5 0 0 1 16 0"/><path d="M2 14h20"/><path d="M4.5 14c.5 3 3.5 5 7.5 5s7-2 7.5-5"/><path d="M9 10.5h6"/><path d="M8 21h8"/>`
  ),
  /** A face with glasses and a moustache (a father). Faces tell family members apart. */
  tpnFaceDad: svg(
    `<circle cx="12" cy="12" r="10"/><circle cx="8.5" cy="10" r="2"/><circle cx="15.5" cy="10" r="2"/><path d="M10.5 10h3"/><path d="M8 15.5c1.6-1.2 2.8-1.2 4 0 1.2-1.2 2.4-1.2 4 0"/>`
  ),
  /** A face with a hair bun (a mother). */
  tpnFaceMom: svg(
    `<circle cx="12" cy="3.5" r="1.8"/><circle cx="12" cy="13.5" r="8"/><path d="M4.5 11c3-.2 5.5-1.6 7.5-4 2 2.4 4.5 3.8 7.5 4"/><path d="M9.5 13.5h.01"/><path d="M14.5 13.5h.01"/><path d="M9.5 17a3.5 3.5 0 0 0 5 0"/>`
  ),
  /** A face with bushy eyebrows and wrinkles (a grandparent). */
  tpnFaceGrandpa: svg(
    `<circle cx="12" cy="12" r="10"/><path d="M2.5 9c1.5-1 3-1 4 .5"/><path d="M21.5 9c-1.5-1-3-1-4 .5"/><path d="M8 9.5h2"/><path d="M14 9.5h2"/><path d="M9 12.5h.01"/><path d="M15 12.5h.01"/><path d="M8.5 16.5c2 1.5 5 1.5 7 0"/>`
  ),
  /** A face with a fringe. */
  tpnFaceBoy: svg(
    `<circle cx="12" cy="12" r="10"/><path d="M2.5 9.5c3.5.3 6.8-.9 9-3.5 1.6 2.4 4.7 3.6 10 3.5"/><path d="M9 12.5h.01"/><path d="M15 12.5h.01"/><path d="M9 16a4 4 0 0 0 6 0"/>`
  ),
  /** A face under a cap. */
  tpnFaceCap: svg(
    `<circle cx="12" cy="13" r="9"/><path d="M3.5 10a8.5 8 0 0 1 17 0Z"/><path d="M20.5 10H23"/><path d="M9 13.5h.01"/><path d="M15 13.5h.01"/><path d="M9.5 17a3.5 3.5 0 0 0 5 0"/>`
  ),
  /** A face with a beard. */
  tpnFaceBeard: svg(
    `<circle cx="12" cy="12" r="10"/><path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M4 15c1.5 2 3 2.5 4.5 2.5 1.5 0 2.3-1.5 3.5-1.5s2 1.5 3.5 1.5c1.5 0 3-.5 4.5-2.5"/><path d="M10 13.5h4"/>`
  ),
  /** A face framed by long hair. */
  tpnFaceLongHair: svg(
    `<path d="M5 21V11a7 7 0 0 1 14 0v10"/><circle cx="12" cy="12" r="5.5"/><path d="M10 11.5h.01"/><path d="M14 11.5h.01"/><path d="M10.5 14.5a2 2 0 0 0 3 0"/>`
  ),
} as const

export type TpnIcon = keyof typeof TPN_ICONS
