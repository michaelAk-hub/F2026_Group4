/**
 * @jest-environment jsdom
 */
// Tests for the payment form - Stefania (Week 4, payment API added in Week 5)
// The page is loaded from reservation.html. The scripts do not run here,
// so the tests put the reservation ids on the form like Maria's reserve.js does.
// fetch is replaced with a fake server, so no backend is needed.

const fs = require("fs");
const path = require("path");
const payment = require("../js/payment");

// 10 November 2026, so the tests do not change with the real date
const today = new Date(2026, 10, 10);

const goodCard = {
  cardName: "Maria Pappa",
  cardNumber: "4242 4242 4242 4242",
  expiry: "12/27",
  cvv: "123"
};

// copy the good card and change one field
function cardWith(field, value) {
  const card = Object.assign({}, goodCard);
  card[field] = value;
  return card;
}

function fillForm(card) {
  document.getElementById("cardName").value = card.cardName;
  document.getElementById("cardNumber").value = card.cardNumber;
  document.getElementById("expiry").value = card.expiry;
  document.getElementById("cvv").value = card.cvv;
}

function errorOf(field) {
  return document.querySelector('#payment-form .error[data-for="' + field + '"]').textContent;
}

// a fake server: the payment answer and the confirm answer
function fakeServer(paymentOk) {
  global.fetch = jest.fn(async (url) => {
    if (url.endsWith("/payments")) {
      if (!paymentOk) {
        return { ok: false, status: 402, json: async () => ({ message: "Your card was declined. Please try another card." }) };
      }
      return { ok: true, status: 200, json: async () => ({ message: "Payment successful.", receipt: { receiptId: "RCPT-12345ABCDE", cardLast4: "4242" } }) };
    }
    return { ok: true, status: 200, json: async () => ({ message: "Reservation confirmed.", reservation: { status: "Paid" } }) };
  });
}

// the form after Maria's "Continue to payment"
function reservationCreated() {
  const form = document.getElementById("payment-form");
  form.dataset.reservationId = "res123";
  form.dataset.paymentId = "pay456";
}

beforeEach(() => {
  const html = fs.readFileSync(path.join(__dirname, "..", "reservation.html"), "utf8");
  document.documentElement.innerHTML = html;
  sessionStorage.clear();
  localStorage.setItem("token", "test-token");
  fakeServer(true);
});

afterEach(() => {
  delete global.fetch;
  localStorage.clear();
});

describe("card validation, same rules as the server (RQ11)", () => {
  test("a correct card has no errors", () => {
    const result = payment.validatePayment(goodCard, today);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  test("Luhn check: a real number passes, a mistyped one fails", () => {
    expect(payment.passesLuhn("4242424242424242")).toBe(true);
    expect(payment.passesLuhn("4242424242424241")).toBe(false);
  });

  test("the card number must have 13 to 19 digits and pass the Luhn check", () => {
    expect(payment.validatePayment(cardWith("cardNumber", "4242 4242 4242 4241"), today).errors.cardNumber).toBeDefined();
    expect(payment.validatePayment(cardWith("cardNumber", "4242 4242 4242 abcd"), today).errors.cardNumber).toBeDefined();
    expect(payment.validatePayment(cardWith("cardNumber", "4242"), today).errors.cardNumber).toBeDefined();
    // a 15 digit card (American Express test number)
    expect(payment.validatePayment(cardWith("cardNumber", "3782 822463 10005"), today).valid).toBe(true);
  });

  test("spaces and dashes in the card number are allowed", () => {
    expect(payment.validatePayment(cardWith("cardNumber", "4242-4242-4242-4242"), today).valid).toBe(true);
  });

  test("the expiry must be MM/YY with a real month", () => {
    expect(payment.validatePayment(cardWith("expiry", "1/27"), today).errors.expiry).toBeDefined();
    expect(payment.validatePayment(cardWith("expiry", "13/27"), today).errors.expiry).toBeDefined();
    expect(payment.validatePayment(cardWith("expiry", "00/27"), today).errors.expiry).toBeDefined();
  });

  test("an expired card is not accepted, this month is still ok", () => {
    expect(payment.isExpiryOk("10/26", today)).toBe(false);
    expect(payment.isExpiryOk("12/25", today)).toBe(false);
    expect(payment.isExpiryOk("11/26", today)).toBe(true);
  });

  test("the CVV must be 3 or 4 digits", () => {
    expect(payment.validatePayment(cardWith("cvv", "12"), today).errors.cvv).toBeDefined();
    expect(payment.validatePayment(cardWith("cvv", "12a"), today).errors.cvv).toBeDefined();
    expect(payment.validatePayment(cardWith("cvv", "12345"), today).errors.cvv).toBeDefined();
    expect(payment.validatePayment(cardWith("cvv", "1234"), today).valid).toBe(true);
  });

  test("the name on the card is needed", () => {
    expect(payment.validatePayment(cardWith("cardName", " "), today).errors.cardName).toBeDefined();
  });
});

describe("errors on the page", () => {
  test("each error is written under its field", () => {
    payment.showErrors({ cvv: "The CVV must be 3 or 4 digits." });
    expect(errorOf("cvv")).toBe("The CVV must be 3 or 4 digits.");
    expect(errorOf("cardNumber")).toBe("");
  });

  test("old errors are removed when the field is fixed", () => {
    payment.showErrors({ cvv: "The CVV must be 3 or 4 digits." });
    payment.showErrors({});
    expect(errorOf("cvv")).toBe("");
  });
});

describe("sending the payment to the server (BUG-06)", () => {
  test("first pays with POST /api/payments, then confirms the reservation", async () => {
    await payment.sendPayment("res123", goodCard);
    const urls = global.fetch.mock.calls.map((call) => call[0]);
    expect(urls.length).toBe(2);
    expect(urls[0]).toBe("http://localhost:3000/api/payments");
    expect(urls[1]).toBe("http://localhost:3000/api/reservations/res123/confirm");
  });

  test("the payment sends the reservation and the card with the token, but not the amount", async () => {
    await payment.sendPayment("res123", goodCard);
    const options = global.fetch.mock.calls[0][1];
    const body = JSON.parse(options.body);
    expect(options.headers.Authorization).toBe("Bearer test-token");
    expect(body.reservationId).toBe("res123");
    expect(body.cardNumber).toBe("4242 4242 4242 4242");
    expect(body.amount).toBeUndefined();
  });

  test("a declined card is not confirmed and gives the server's message", async () => {
    fakeServer(false);
    await expect(payment.sendPayment("res123", goodCard)).rejects.toThrow("Your card was declined");
    expect(global.fetch.mock.calls.length).toBe(1);
  });
});

describe("clicking PAY", () => {
  test("a wrong card shows the errors and does not call the server", async () => {
    reservationCreated();
    fillForm(cardWith("cardNumber", "1234"));
    const paid = await payment.handlePay();
    expect(paid).toBe(false);
    expect(errorOf("cardNumber")).not.toBe("");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("it does not pay before the reservation is created (RQ09)", async () => {
    fillForm(goodCard);
    const paid = await payment.handlePay();
    expect(paid).toBe(false);
    expect(document.getElementById("payment-message").textContent).toContain("Continue to payment");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("a good card saves the receipt with the IDs and the receipt number", async () => {
    reservationCreated();
    fillForm(goodCard);

    const paid = await payment.handlePay();
    expect(paid).toBe(true);

    const receipt = JSON.parse(sessionStorage.getItem("receipt"));
    expect(receipt.reservationId).toBe("res123");
    expect(receipt.paymentId).toBe("pay456");
    expect(receipt.receiptId).toBe("RCPT-12345ABCDE");
    expect(receipt.status).toBe("Paid");
    expect(receipt.card).toBe("**** **** **** 4242");
    expect(receipt.spot).toBe("05");
  });

  test("a declined card shows the message and the driver can try again", async () => {
    fakeServer(false);
    reservationCreated();
    fillForm(goodCard);

    const paid = await payment.handlePay();
    expect(paid).toBe(false);
    expect(document.getElementById("payment-message").textContent).toContain("declined");
    expect(document.getElementById("pay-button").disabled).toBe(false);
    expect(sessionStorage.getItem("receipt")).toBeNull();
  });

  test("the full card number and the CVV are not saved", async () => {
    reservationCreated();
    fillForm(goodCard);
    await payment.handlePay();
    const saved = sessionStorage.getItem("receipt");
    expect(saved).not.toContain("4242 4242 4242 4242");
    expect(saved).not.toContain("4242424242424242");
    expect(saved).not.toContain("cvv");
  });
});

test("reservation page loads payment.js after reserve.js and calls setupPayment()", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "reservation.html"), "utf8");
  expect(html.indexOf('src="js/payment.js"')).toBeGreaterThan(html.indexOf('src="js/reserve.js"'));
  expect(html).toContain("setupPayment()");
  expect(document.getElementById("pay-button").textContent).toContain("PAY");
});
