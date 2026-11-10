// Receipt page - Stefania (Week 4)
// payment.js saves the receipt in sessionStorage after the payment,
// this file reads it and shows it (RQ11).

// put the receipt values in the page
function showReceipt(receipt) {
  document.getElementById("receipt-spot").textContent = receipt.spot;
  document.getElementById("receipt-date").textContent = receipt.date;
  document.getElementById("receipt-time").textContent = receipt.time;
  document.getElementById("receipt-duration").textContent = receipt.duration;
  document.getElementById("receipt-reservation-id").textContent = receipt.reservationId;
  document.getElementById("receipt-payment-id").textContent = receipt.paymentId;
  document.getElementById("receipt-card").textContent = receipt.card;
  document.getElementById("receipt-amount").textContent = receipt.amount;
  document.getElementById("receipt-status").textContent = receipt.status;

  document.getElementById("receipt").hidden = false;
  document.getElementById("no-receipt").hidden = true;
}

// receipt.html calls this once when the page opens
function loadReceipt() {
  var saved = sessionStorage.getItem("receipt");
  if (!saved) {
    document.getElementById("receipt").hidden = true;
    document.getElementById("no-receipt").hidden = false;
    return;
  }
  showReceipt(JSON.parse(saved));
}

// lets the Jest tests use the functions (the browser ignores this)
if (typeof module !== "undefined") {
  module.exports = { showReceipt, loadReceipt };
}
