// Payment form - Stefania (Week 4, connected to the payment API in Week 5)
// Checks the card details on the reservation page (RQ09, RQ11).
// Maria's reserve.js creates the reservation first and puts its ids on the form,
// then the driver pays here and goes to the receipt page.

// the address of the backend. api.js sets API_BASE_URL in the browser,
// the Jest tests do not load api.js so they use the same address from here.
var PAYMENT_API_URL = typeof API_BASE_URL !== "undefined" ? API_BASE_URL : "http://localhost:3000/api";

// "4242 4242-4242 4242" -> "4242424242424242"
function onlyDigits(text) {
  return text.replace(/[ -]/g, "");
}

// Luhn check, the same as Neofytos's payment service.
// From the right, double every second digit (minus 9 if it is more than 9)
// and add everything. A real card number gives a total we can divide by 10.
function passesLuhn(digits) {
  var sum = 0;
  var double = false;
  for (var i = digits.length - 1; i >= 0; i--) {
    var n = Number(digits[i]);
    if (double) {
      n = n * 2;
      if (n > 9) {
        n = n - 9;
      }
    }
    sum = sum + n;
    double = !double;
  }
  return sum % 10 === 0;
}

// the expiry is "MM/YY", the card works until the end of that month
function isExpiryOk(expiry, today) {
  if (!/^[0-9]{2}\/[0-9]{2}$/.test(expiry)) {
    return false;
  }
  var month = Number(expiry.slice(0, 2));
  var year = 2000 + Number(expiry.slice(3, 5));
  if (month < 1 || month > 12) {
    return false;
  }

  var thisYear = today.getFullYear();
  var thisMonth = today.getMonth() + 1; // getMonth() starts from 0
  if (year < thisYear) {
    return false;
  }
  if (year === thisYear && month < thisMonth) {
    return false;
  }
  return true;
}

// the same rules as the server (paymentService.js), so the driver sees
// the mistake before sending. Same idea as Maria's validators.js.
function validatePayment(data, today) {
  var errors = {};

  if (data.cardName.trim().length < 2) {
    errors.cardName = "Please enter the name on the card.";
  }

  var digits = onlyDigits(data.cardNumber);
  if (!/^[0-9]{13,19}$/.test(digits) || !passesLuhn(digits)) {
    errors.cardNumber = "The card number is not valid.";
  }

  if (!isExpiryOk(data.expiry.trim(), today)) {
    errors.expiry = "Use MM/YY and a date that is not in the past.";
  }

  if (!/^[0-9]{3,4}$/.test(data.cvv.trim())) {
    errors.cvv = "The CVV must be 3 or 4 digits.";
  }

  return { valid: Object.keys(errors).length === 0, errors: errors };
}

// write the error under each field (empty text = no error)
function showErrors(errors) {
  var boxes = document.querySelectorAll("#payment-form .error");
  for (var i = 0; i < boxes.length; i++) {
    var field = boxes[i].dataset.for;
    boxes[i].textContent = errors[field] || "";
  }
}

// send data to the backend with the driver's token.
// If the server says no, we throw an error with the server's message.
async function postWithToken(path, data) {
  var response = await fetch(PAYMENT_API_URL + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + localStorage.getItem("token")
    },
    body: JSON.stringify(data)
  });
  var result = await response.json();
  if (!response.ok) {
    throw new Error(result.message || "The payment failed. Please try again.");
  }
  return result;
}

// BUG-06: pay with Neofytos's payment API, then confirm with Giorgos's API.
// The amount is not sent, the server already knows it (RQ09).
async function sendPayment(reservationId, card) {
  var paid = await postWithToken("/payments", {
    reservationId: reservationId,
    cardName: card.cardName,
    cardNumber: card.cardNumber,
    expiry: card.expiry,
    cvv: card.cvv
  });

  // only after a complete payment the reservation can be confirmed
  var confirmed = await postWithToken("/reservations/" + reservationId + "/confirm", {});

  return {
    receiptId: paid.receipt.receiptId,
    cardLast4: paid.receipt.cardLast4,
    status: confirmed.reservation.status
  };
}

// the text of Date, Time, Duration and Total from Maria's ticket
function readTicket() {
  var values = document.querySelectorAll("#reservation-summary .ticket-details b");
  return {
    spot: document.querySelector("#reservation-summary .ticket-spot").textContent,
    date: values[0].textContent,
    time: values[1].textContent,
    duration: values[2].textContent,
    amount: document.querySelector("#reservation-summary .ticket-total b").textContent
  };
}

// runs when the driver clicks PAY. Gives back true when the payment worked.
async function handlePay() {
  var form = document.getElementById("payment-form");
  var message = document.getElementById("payment-message");
  var button = document.getElementById("pay-button");

  var data = {
    cardName: document.getElementById("cardName").value,
    cardNumber: document.getElementById("cardNumber").value,
    expiry: document.getElementById("expiry").value,
    cvv: document.getElementById("cvv").value
  };

  var result = validatePayment(data, new Date());
  showErrors(result.errors);
  if (!result.valid) {
    message.textContent = "Please fix the card details.";
    return false;
  }

  // RQ09: there must be a reservation before the payment
  if (!form.dataset.reservationId) {
    message.textContent = "Please click \"Continue to payment\" first.";
    return false;
  }

  button.disabled = true;
  message.textContent = "Paying...";

  try {
    var payment = await sendPayment(form.dataset.reservationId, data);

    // the receipt page reads this. Only the last 4 digits from the server,
    // no full card number and no CVV (PCI-DSS).
    var receipt = readTicket();
    receipt.reservationId = form.dataset.reservationId;
    receipt.paymentId = form.dataset.paymentId;
    receipt.receiptId = payment.receiptId;
    receipt.status = payment.status;
    receipt.card = "**** **** **** " + payment.cardLast4;
    sessionStorage.setItem("receipt", JSON.stringify(receipt));

    message.textContent = "Payment complete.";
    return true;
  } catch (error) {
    // for example "Your card was declined. Please try another card."
    message.textContent = error.message;
    button.disabled = false;
    return false;
  }
}

// reservation.html calls this once when the page opens
function setupPayment() {
  document.getElementById("pay-button").addEventListener("click", async function () {
    var paid = await handlePay();
    if (paid) {
      window.location.href = "receipt.html";
    }
  });
}

// lets the Jest tests use the functions (the browser ignores this)
if (typeof module !== "undefined") {
  module.exports = { onlyDigits, passesLuhn, isExpiryOk, validatePayment, showErrors, postWithToken, sendPayment, readTicket, handlePay, setupPayment };
}
