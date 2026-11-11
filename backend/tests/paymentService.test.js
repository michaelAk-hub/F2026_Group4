// Tests for the mock payment service (src/services/paymentService.js). No database needed.
// Run with: npm test
const { validateCard, chargeCard, passesLuhn, DECLINED_TEST_CARDS } = require('../src/services/paymentService');

// A fixed "today", so the tests give the same result every day: 15 November 2026
const TODAY = new Date(2026, 10, 15);

const GOOD_CARD = { cardName: 'Maria Driver', cardNumber: '4242 4242 4242 4242', expiry: '12/28', cvv: '123' };

describe('Mock payment service', () => {
  test('TC-G37: a correct card has no problems', () => {
    expect(validateCard(GOOD_CARD, TODAY)).toEqual([]);
  });

  test('TC-G38: the Luhn check accepts a real number and rejects a mistyped one', () => {
    expect(passesLuhn('4242424242424242')).toBe(true);
    expect(passesLuhn('4242424242424241')).toBe(false); // last digit changed
    expect(validateCard({ ...GOOD_CARD, cardNumber: '4242 4242 4242 4241' }, TODAY)).toContain('The card number is not valid.');
  });

  test('TC-G39: spaces and dashes in the card number are ignored, letters are not', () => {
    expect(validateCard({ ...GOOD_CARD, cardNumber: '4242-4242-4242-4242' }, TODAY)).toEqual([]);
    expect(validateCard({ ...GOOD_CARD, cardNumber: '4242 abcd 4242 4242' }, TODAY).length).toBeGreaterThan(0);
  });

  test('TC-G40: an expired card is rejected, the current month still works', () => {
    expect(validateCard({ ...GOOD_CARD, expiry: '10/26' }, TODAY)).toContain('This card has expired.');
    expect(validateCard({ ...GOOD_CARD, expiry: '11/26' }, TODAY)).toEqual([]); // valid until the end of November
  });

  test('TC-G41: the expiry must look like MM/YY', () => {
    for (const bad of ['', '1228', '13/28', '00/28', '12-28', undefined]) {
      expect(validateCard({ ...GOOD_CARD, expiry: bad }, TODAY)).toContain('Please enter the expiry date as MM/YY.');
    }
  });

  test('TC-G42: the CVV must be 3 or 4 digits', () => {
    expect(validateCard({ ...GOOD_CARD, cvv: '1234' }, TODAY)).toEqual([]);
    for (const bad of ['12', '12345', 'abc', '', undefined]) {
      expect(validateCard({ ...GOOD_CARD, cvv: bad }, TODAY)).toContain('The CVV must be 3 or 4 digits.');
    }
  });

  test('TC-G43: a missing name is rejected, and an empty form gives all the messages', () => {
    expect(validateCard({ ...GOOD_CARD, cardName: '  ' }, TODAY)).toContain('Please enter the name on the card.');
    expect(validateCard({}, TODAY)).toHaveLength(4);
    expect(validateCard(undefined, TODAY)).toHaveLength(4);
  });

  test('TC-G44: an approved charge gives a receipt id and ONLY the last 4 digits (PCI-DSS)', () => {
    const result = chargeCard(GOOD_CARD, 4);

    expect(result.approved).toBe(true);
    expect(result.receiptId).toMatch(/^RCPT-[0-9A-F]{10}$/);
    expect(result.cardLast4).toBe('4242');
    // nothing in the result contains the full number or the CVV
    const text = JSON.stringify(result);
    expect(text).not.toContain('4242424242424242');
    expect(text).not.toContain('4242 4242 4242 4242');
    expect(text).not.toContain('cvv');
  });

  test('TC-G45: the demo test card is declined, with no receipt', () => {
    const result = chargeCard({ cardNumber: DECLINED_TEST_CARDS[0] }, 4);

    expect(result.approved).toBe(false);
    expect(result.message).toBe('Your card was declined. Please try another card.');
    expect(result.receiptId).toBeUndefined();
    expect(result.cardLast4).toBeUndefined();
    // the declined card is a valid number, so it passes the form checks and is refused by the "bank"
    expect(validateCard({ ...GOOD_CARD, cardNumber: DECLINED_TEST_CARDS[0] }, TODAY)).toEqual([]);
  });

  test('TC-G46: every approved charge gets a different receipt id', () => {
    const ids = new Set();
    for (let i = 0; i < 50; i++) ids.add(chargeCard(GOOD_CARD, 4).receiptId);
    expect(ids.size).toBe(50);
  });

  test('TC-G47: charging an amount of 0 or less is an error', () => {
    expect(() => chargeCard(GOOD_CARD, 0)).toThrow();
    expect(() => chargeCard(GOOD_CARD, -5)).toThrow();
    expect(() => chargeCard(GOOD_CARD, undefined)).toThrow();
  });
});
