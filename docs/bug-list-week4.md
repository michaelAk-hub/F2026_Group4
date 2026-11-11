# Bug list – Week 4 integration test

**Integration test of register → map → reserve → pay** – Member 5 (Michalis Koutoumbas)
Checked against `main` at commit `e882fcf` (11/11/2026), after the payment API of Member 4,
the reservation flow of Member 1, the payment form of Member 2 and the expiry job of Member 3.

Tests:
- `backend/tests/integration.flow.test.js` – TC-MK27 – TC-MK41 (run: `cd backend && npm test`)
- `frontend/tests/integration.payment.test.js` – TC-MK42 (run: `cd frontend && npm test`)

The backend test runs the real API with a real temporary MongoDB, the live map stream (Member 5),
the sensor service and the payment API (Member 4) and the expiry job (Member 3) together, and sends
the same requests as the pages.

## Result

| Step | Test | Result |
|---|---|---|
| Register and log in | TC-MK27 | ✅ works |
| Map after login | TC-MK28 | ✅ works |
| Reserve (Unpaid, price, no confirm before paying) | TC-MK29 | ✅ works |
| Pay by card, receipt, only last 4 digits saved, confirm, map shows reserved | TC-MK30 | ✅ works |
| Live map gets the reserved spot | TC-MK31 | ✅ works |
| Declined card, pay again with another card | TC-MK32 | ✅ works |
| The same reservation cannot be paid twice | TC-MK33 | ✅ works |
| Same spot, same time → 409 | TC-MK34 | ✅ works |
| Only the owner can pay and confirm, login needed | TC-MK35 | ✅ works |
| Driver parks and leaves, map follows the sensor | TC-MK36 | ✅ works |
| Unpaid reservation released after 15 minutes | TC-MK37 | ✅ works (was BUG-05) |
| Spot empty again after a paid reservation ends | TC-MK38 | ✅ works (was BUG-04) |
| Open bugs | TC-MK39 – TC-MK42 | ❌ BUG-01, BUG-02, BUG-03, BUG-06 (tests marked `test.failing`) |

A `test.failing` test describes the **correct** behaviour. It fails today, so Jest shows it as passed and CI stays green.
When the bug is fixed, Jest reports that test → change `test.failing` to `test`.

## Open bugs

### BUG-06 – The PAY button does not send the payment to the server  · **High (demo)** · RQ09, RQ10
- **Steps:** on reservation.html continue to payment, fill a valid card and click PAY.
- **Expected:** the page sends the card to `POST /api/payments`, then confirms with `POST /api/reservations/:id/confirm`, then opens the receipt.
- **Actual:** `sendPayment()` in `frontend/js/payment.js` is still the mock from before the payment API existed (*"Neofytos's payment service is not on main yet"*). It always answers "Complete" and calls no server. The driver sees "Payment complete" and a receipt, but on the server the reservation stays **Unpaid**, the spot is **never reserved** on the map, and after 15 minutes the expiry job **deletes the reservation**.
- **Idea for the fix:** in `sendPayment()` call `postToApi('/payments', { reservationId, cardName, cardNumber, expiry, cvv }, token)`, then `postToApi('/reservations/' + reservationId + '/confirm', {}, token)`; show the server's message when it fails (e.g. a declined card); show the server's `receiptId` on the receipt page.
- **Test:** TC-MK42 · **Owner:** Member 2 (payment form)

### BUG-01 – Double booking when two drivers reserve at the same moment  · **High** · RQ08
- **Steps:** two (or more) drivers send `POST /api/reservations` for the same spot and the same time at the same moment.
- **Expected:** one gets 201, the others get 409.
- **Actual:** all of them get 201. With 5 requests at once, 5 reservations of the same spot were saved.
- **Why:** `createReservation` first checks for an overlap and then creates the reservation in a separate step; requests that arrive together all pass the check before any of them is saved.
- **Idea for the fix:** make "check + create" one step for a spot, e.g. lock the spot with an atomic update (`findOneAndUpdate` on the ParkingSpot) or use a MongoDB transaction, or check again after saving and remove the later reservation. (The payment API already protects "pay twice" in a similar way.)
- **Test:** TC-MK39 · **Owner:** Member 3 (reservation API)

### BUG-02 – A reservation for later shows the spot as reserved now  · **Medium** · RQ05, RQ26
- **Steps:** reserve a spot for tomorrow, pay, confirm. Open the map today.
- **Expected:** the spot is shown as empty until the reservation starts.
- **Actual:** the spot is shown as reserved right after the payment, so nobody else sees it as free today.
- **Why:** `confirmReservation` sets `spotStatus = 'Reserved'` without checking the start time, and the expiry job keeps it Reserved for a paid reservation that "starts later".
- **Idea for the fix:** set Reserved only when the reservation has started; the expiry job can set it when a later reservation starts.
- **Test:** TC-MK40 · **Owner:** Member 3

### BUG-03 – A very short reservation costs 0.00 and then cannot be paid  · **Medium** · RQ09, RQ27
- **Steps:** reserve a spot for a few seconds (e.g. 2 seconds), then pay it.
- **Expected:** the reservation is refused (minimum duration), or it costs more than 0 and can be paid.
- **Actual:** the reservation is created with `amount: 0`. Paying it returns **500 "Something went wrong"**, because the mock bank refuses an amount of 0 (`chargeCard` throws).
- **Idea for the fix:** a minimum duration (e.g. 15 minutes) in `createReservation`, or a minimum price.
- **Test:** TC-MK41 · **Owner:** Member 3

## Fixed since the first test run (9/11/2026)

| ID | Was | Fixed by |
|---|---|---|
| B-1 | No payment API (`POST /api/payments` 404) – blocker | Member 4 – mock payment service (`2a4ffb8`) |
| B-2 | Reservation page did not call the API – blocker | Member 1 – reservation flow (`2224fc4`). The payment form is still not connected → **BUG-06** |
| BUG-04 | Spot stayed reserved after the reservation ended | Member 3 – expiry job (`e882fcf`), checked by TC-MK38 |
| BUG-05 | An unpaid reservation blocked the spot for ever | Member 3 – expiry job (`e882fcf`, 15 minutes), checked by TC-MK37 |

## Other findings (not bugs in the flow)

| ID | Finding | Suggestion | Owner |
|---|---|---|---|
| N-1 | The scripts of Member 4 say `npm run seed:sensors` and `npm run simulator`, but these commands are not in `backend/package.json`. | Add them to `"scripts"`, or change the comments to `node scripts/...`. | Member 4 |
| N-2 | Running `npx jest` directly makes all database tests fail ("Missing required sub-document 'driver'"). Only `npm test` works, because it starts Jest with `--experimental-vm-modules`. | Always use `npm test`; mention it in the README. | All |
| N-3 | `GET /api/spots` and `/api/spots/stream` can be opened without login, while the map page needs a login. | Decide as a team if the spot data must be private; if yes, add `requireAuth` (the stream then needs the token in the URL, because EventSource cannot send headers). | Member 5 |
