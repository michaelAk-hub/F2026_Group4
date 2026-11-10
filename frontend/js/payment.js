// Payment form - Stefania (Week 4)
// Checks the card details on the reservation page (RQ09, RQ11).
// Maria's reserve.js creates the reservation first and puts its ids on the form,
// then the driver pays here and goes to the receipt page.

// "4111 1111 1111 1111" -> "4111111111111111"
function onlyDigits(text) {
  return text.replace(/ /g, "");
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

// same idea as Maria's validators.js: { valid: true/false, errors: {...} }
function validatePayment(data, today) {
  var errors = {};

  if (!/^[A-Za-z ]{2,}$/.test(data.cardName.trim())) {
    errors.cardName = "Enter the name on the card.";
  }
  if (!/^[0-9]{16}$/.test(onlyDigits(data.cardNumber))) {
    errors.cardNumber = "The card number must have 16 digits.";
  }
  if (!isExpiryOk(data.expiry.trim(), today)) {
    errors.expiry = "Use MM/YY and a date that is not in the past.";
  }
  if (!/^[0-9]{3}$/.test(data.cvv.trim())) {
    errors.cvv = "The CVV must have 3 digits.";
  }

  return { valid: Object.keys(errors).length === 0, errors: errors };
}

// we keep only the last 4 digits, never the full card number (PCI-DSS)
function maskCard(cardNumber) {
  var digits = onlyDigits(cardNumber);
  return "**** **** **** " + digits.slice(-4);
}

// write the error under each field (empty text = no error)
function showErrors(errors) {
  var boxes = document.querySelectorAll("#payment-form .error");
  for (var i = 0; i < boxes.length; i++) {
    var field = boxes[i].dataset.for;
    boxes[i].textContent = errors[field] || "";
  }
}

// Mock payment: Neofytos's payment service is not on main yet.
// When it is, this function will send the payment to the backend and
// then call /reservations/:id/confirm. The rest of the page stays the same.
function sendPayment(reservationId, paymentId, card) {
  return Promise.resolve({
    paymentId: paymentId,
    status: "Complete",
    paidAt: new Date().toISOString()
  });
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
    var card = maskCard(data.cardNumber);
    var payment = await sendPayment(form.dataset.reservationId, form.dataset.paymentId, card);

    // the receipt page reads this. No full card number and no CVV in it.
    var receipt = readTicket();
    receipt.reservationId = form.dataset.reservationId;
    receipt.paymentId = payment.paymentId;
    receipt.status = payment.status;
    receipt.paidAt = payment.paidAt;
    receipt.card = card;
    sessionStorage.setItem("receipt", JSON.stringify(receipt));

    message.textContent = "Payment complete.";
    return true;
  } catch (error) {
    message.textContent = "The payment failed. Please try again.";
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
  module.exports = { onlyDigits, isExpiryOk, validatePayment, maskCard, showErrors, sendPayment, readTicket, handlePay, setupPayment };
}
