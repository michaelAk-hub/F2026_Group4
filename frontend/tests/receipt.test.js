/**
 * @jest-environment jsdom
 */
// Tests for the receipt page - Stefania (Week 4)

const fs = require("fs");
const path = require("path");
const receipt = require("../js/receipt");

// what payment.js saves after a payment
const savedReceipt = {
  spot: "05",
  date: "26 Nov 2026",
  time: "14:00 – 16:00",
  duration: "2 hours",
  amount: "€4.00",
  reservationId: "res123",
  paymentId: "pay456",
  status: "Complete",
  card: "**** **** **** 1111"
};

beforeEach(() => {
  const html = fs.readFileSync(path.join(__dirname, "..", "receipt.html"), "utf8");
  document.documentElement.innerHTML = html;
  sessionStorage.clear();
});

describe("receipt (RQ11)", () => {
  test("without a payment the page shows a message", () => {
    receipt.loadReceipt();
    expect(document.getElementById("no-receipt").hidden).toBe(false);
    expect(document.getElementById("receipt").hidden).toBe(true);
  });

  test("the receipt shows the reservation ID and the payment ID", () => {
    sessionStorage.setItem("receipt", JSON.stringify(savedReceipt));
    receipt.loadReceipt();
    expect(document.getElementById("receipt").hidden).toBe(false);
    expect(document.getElementById("receipt-reservation-id").textContent).toBe("res123");
    expect(document.getElementById("receipt-payment-id").textContent).toBe("pay456");
  });

  test("the receipt shows the spot, amount, status and the masked card", () => {
    sessionStorage.setItem("receipt", JSON.stringify(savedReceipt));
    receipt.loadReceipt();
    expect(document.getElementById("receipt-spot").textContent).toBe("05");
    expect(document.getElementById("receipt-amount").textContent).toBe("€4.00");
    expect(document.getElementById("receipt-status").textContent).toBe("Complete");
    expect(document.getElementById("receipt-card").textContent).toBe("**** **** **** 1111");
  });
});

describe("receipt page", () => {
  test("uses tokens.css and layout.css", () => {
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    expect(links[0].getAttribute("href")).toBe("css/tokens.css");
    expect(links[1].getAttribute("href")).toBe("css/layout.css");
  });

  test("only a logged in driver can open it", () => {
    const html = fs.readFileSync(path.join(__dirname, "..", "receipt.html"), "utf8");
    expect(html).toContain('src="js/auth.js"');
    expect(html).toContain('requireRole("driver")');
  });

  test("loads receipt.js and calls loadReceipt()", () => {
    const html = fs.readFileSync(path.join(__dirname, "..", "receipt.html"), "utf8");
    expect(html).toContain('src="js/receipt.js"');
    expect(html).toContain("loadReceipt()");
  });

  test("has links back to the dashboard and to My Reservations", () => {
    const links = document.querySelectorAll(".receipt-buttons a");
    expect(links[0].getAttribute("href")).toBe("dashboard.html");
    expect(links[1].getAttribute("href")).toBe("my-reservations.html");
  });
});
