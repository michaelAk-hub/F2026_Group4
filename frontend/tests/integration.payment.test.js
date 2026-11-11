/**
 * @jest-environment jsdom
 */
// Integration check of the payment page with the backend (Member 5, Week 4).
// The backend now has the payment API of Member 4 (POST /api/payments) and the confirm step of
// Member 3 (POST /api/reservations/:id/confirm). The PAY button must use them, otherwise the
// driver sees a receipt while the reservation stays Unpaid on the server.
//
// test.failing = BUG-06 in docs/bug-list-week4.md: sendPayment() is still a mock that never calls
// the server. When it is connected, Jest reports this test -> change test.failing to test.

const payment = require('../js/payment');

beforeEach(() => {
  localStorage.setItem('token', 'test-token');
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ message: 'ok', receipt: { receiptId: 'RCPT-TEST', cardLast4: '4242' }, reservation: { status: 'Paid' } }),
  }));
});

afterEach(() => {
  delete global.fetch;
  localStorage.clear();
});

test.failing('TC-MK42 / BUG-06: PAY sends the payment to POST /api/payments and then confirms the reservation (RQ09, RQ10)', async () => {
  await payment.sendPayment('reservation-1', 'payment-1', '**** **** **** 4242');

  const urls = global.fetch.mock.calls.map((call) => String(call[0]));
  expect(urls.some((u) => u.endsWith('/api/payments'))).toBe(true);
  expect(urls.some((u) => u.endsWith('/api/reservations/reservation-1/confirm'))).toBe(true);
});
