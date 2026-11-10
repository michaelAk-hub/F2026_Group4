/**
 * @jest-environment jsdom
 */
// Tests for the payment form - Stefania (Week 4)
// The page is loaded from reservation.html. The scripts do not run here,
// so the tests put the reservation ids on the form like Maria's reserve.js does.

const fs = require("fs");
const path = require("path");
const payment = require("../js/payment");

// 10 November 2026, so the tests do not change with the real date
const today = new Date(2026, 10, 10);

const goodCard = {
  cardName: "Maria Pappa",
  cardNumber: "4111 1111 1111 1111",
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

beforeEach(() => {
  const html = fs.readFileSync(path.join(__dirname, "..", "reservation.html"), "utf8");
  document.documentElement.innerHTML = html;
  sessionStorage.clear();
});

describe("card validation (RQ11)", () => {
  test("a correct card has no errors", () => {
    const result = payment.validatePayment(goodCard, today);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  test("the card number must have 16 digits", () => {
    expect(payment.validatePayment(cardWith("cardNumber", "4111 1111 1111 111"), today).errors.cardNumber).toBeDefined();
    expect(payment.validatePayment(cardWith("cardNumber", "4111 1111 1111 abcd"), today).errors.cardNumber).toBeDefined();
    expect(payment.validatePayment(cardWith("cardNumber", "4111111111111111"), today).valid).toBe(true);
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

  test("the CVV must have 3 digits", () => {
    expect(payment.validatePayment(cardWith("cvv", "12"), today).errors.cvv).toBeDefined();
    expect(payment.validatePayment(cardWith("cvv", "12a"), today).errors.cvv).toBeDefined();
    expect(payment.validatePayment(cardWith("cvv", "1234"), today).errors.cvv).toBeDefined();
  });

  test("the name on the card is needed", () => {
    expect(payment.validatePayment(cardWith("cardName", ""), today).errors.cardName).toBeDefined();
  });
});

describe("masked card (PCI-DSS)", () => {
  test("only the last 4 digits are kept", () => {
    expect(payment.maskCard("4111 1111 1111 1234")).toBe("**** **** **** 1234");
  });
});

describe("errors on the page", () => {
  test("each error is written under its field", () => {
    payment.showErrors({ cvv: "The CVV must have 3 digits." });
    expect(errorOf("cvv")).toBe("The CVV must have 3 digits.");
    expect(errorOf("cardNumber")).toBe("");
  });

  test("old errors are removed when the field is fixed", () => {
    payment.showErrors({ cvv: "The CVV must have 3 digits." });
    payment.showErrors({});
    expect(errorOf("cvv")).toBe("");
  });
});

describe("clicking PAY", () => {
  test("a wrong card shows the errors and does not pay", async () => {
    document.getElementById("payment-form").dataset.reservationId = "res123";
    fillForm(cardWith("cardNumber", "1234"));
    const paid = await payment.handlePay();
    expect(paid).toBe(false);
    expect(errorOf("cardNumber")).not.toBe("");
    expect(sessionStorage.getItem("receipt")).toBeNull();
  });

  test("it does not pay before the reservation is created (RQ09)", async () => {
    fillForm(goodCard);
    const paid = await payment.handlePay();
    expect(paid).toBe(false);
    expect(document.getElementById("payment-message").textContent).toContain("Continue to payment");
    expect(sessionStorage.getItem("receipt")).toBeNull();
  });

  test("a good card saves the receipt with the reservation and payment IDs", async () => {
    const form = document.getElementById("payment-form");
    form.dataset.reservationId = "res123";
    form.dataset.paymentId = "pay456";
    fillForm(goodCard);

    const paid = await payment.handlePay();
    expect(paid).toBe(true);

    const receipt = JSON.parse(sessionStorage.getItem("receipt"));
    expect(receipt.reservationId).toBe("res123");
    expect(receipt.paymentId).toBe("pay456");
    expect(receipt.status).toBe("Complete");
    expect(receipt.card).toBe("**** **** **** 1111");
    expect(receipt.spot).toBe("05");
    expect(receipt.amount).toBe("€4.00");
  });

  test("the full card number and the CVV are not saved", async () => {
    document.getElementById("payment-form").dataset.reservationId = "res123";
    fillForm(goodCard);
    await payment.handlePay();
    const saved = sessionStorage.getItem("receipt");
    expect(saved).not.toContain("4111 1111 1111 1111");
    expect(saved).not.toContain("4111111111111111");
    expect(saved).not.toContain("cvv");
  });
});

test("reservation page loads payment.js after reserve.js and calls setupPayment()", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "reservation.html"), "utf8");
  expect(html.indexOf('src="js/payment.js"')).toBeGreaterThan(html.indexOf('src="js/reserve.js"'));
  expect(html).toContain("setupPayment()");
  expect(document.getElementById("pay-button").textContent).toContain("PAY");
});
