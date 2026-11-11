// Mock payment service (task 4.4). There is no real bank here: we only PRETEND to charge a card.
// It has no database and no Express code, so it is easy to test.
//
// PCI-DSS (constraint C06): the full card number, expiry and CVV are only used inside these
// functions. Nothing returned from here contains them, only the last 4 digits.
const crypto = require('crypto');

// Test cards for the demo. This card is always declined (it is a valid card number,
// so it passes the checks and the "bank" says no). Every other valid card is approved.
const DECLINED_TEST_CARDS = ['4000000000000002'];

// "4242 4242-4242 4242" -> "4242424242424242" (the form shows the number with spaces)
function cleanCardNumber(value) {
  return String(value === undefined || value === null ? '' : value).replace(/[\s-]/g, '');
}

// Luhn check: the standard test that catches mistyped card numbers.
// Starting from the right, double every second digit (subtract 9 if it becomes > 9),
// add everything up. A valid number gives a total that is a multiple of 10.
function passesLuhn(digits) {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

// "08/27" -> { month: 8, year: 2027 }. Gives null if the text is not in the MM/YY format.
function parseExpiry(value) {
  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(String(value === undefined || value === null ? '' : value).trim());
  if (!match) return null;
  const month = Number(match[1]);
  if (month < 1 || month > 12) return null;
  return { month, year: 2000 + Number(match[2]) };
}

// A card works until the END of its expiry month
function isExpired(expiry, now) {
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1; // getMonth() counts from 0
  return expiry.year < thisYear || (expiry.year === thisYear && expiry.month < thisMonth);
}

// Checks the card details from the payment form. Gives back a list of problems
// (an empty list = all fine). The messages are meant for the driver (RQ27).
function validateCard({ cardName, cardNumber, expiry, cvv } = {}, now = new Date()) {
  const problems = [];

  if (String(cardName === undefined || cardName === null ? '' : cardName).trim().length < 2) {
    problems.push('Please enter the name on the card.');
  }

  const digits = cleanCardNumber(cardNumber);
  if (!/^\d{13,19}$/.test(digits) || !passesLuhn(digits)) {
    problems.push('The card number is not valid.');
  }

  const parsed = parseExpiry(expiry);
  if (!parsed) {
    problems.push('Please enter the expiry date as MM/YY.');
  } else if (isExpired(parsed, now)) {
    problems.push('This card has expired.');
  }

  if (!/^\d{3,4}$/.test(String(cvv === undefined || cvv === null ? '' : cvv))) {
    problems.push('The CVV must be 3 or 4 digits.');
  }

  return problems;
}

// A receipt number like RCPT-3F9A1C07D2. crypto gives random bytes that cannot be guessed.
function makeReceiptId() {
  return 'RCPT-' + crypto.randomBytes(5).toString('hex').toUpperCase();
}

// The mock charge. Call validateCard first. Gives back:
//   approved: { approved: true, receiptId, cardLast4 }
//   declined: { approved: false, message }
function chargeCard({ cardNumber }, amount) {
  if (!(amount > 0)) {
    throw new Error('The amount to charge must be more than 0.');
  }

  const digits = cleanCardNumber(cardNumber);
  if (DECLINED_TEST_CARDS.includes(digits)) {
    return { approved: false, message: 'Your card was declined. Please try another card.' };
  }

  return { approved: true, receiptId: makeReceiptId(), cardLast4: digits.slice(-4) };
}

module.exports = { validateCard, chargeCard, passesLuhn, parseExpiry, cleanCardNumber, DECLINED_TEST_CARDS };
