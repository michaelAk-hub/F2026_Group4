// Week 4 - Maria Antoniou
// Show the selected parking spot and update the ticket as the driver edits the times.

// Same hourly rate used by the reservation controller.
const PRICE_PER_HOUR = 2;

async function showSelectedSpot() {
  const badge = document.querySelector(".ticket-spot");
  const spotId = new URLSearchParams(window.location.search).get("spotId");

  badge.textContent = "—";

  if (!spotId) {
    badge.title = "Choose a spot on the dashboard.";
    return;
  }

  try {
    const response = await fetch(API_BASE_URL + "/spots", {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") },
      cache: "no-store"
    });

    if (!response.ok) throw new Error("Could not load parking spots.");

    const data = await response.json();
    const spot = data.spots.find(function (item) {
      return item.id === spotId;
    });

    if (!spot) {
      badge.title = "This spot is no longer listed.";
      return;
    }

    // Display "Lot A - Spot 02" as "02", just like the dashboard.
    const match = spot.location.match(/ - Spot (\d+)$/);
    badge.textContent = match ? match[1] : spot.location;
    badge.title = spot.location;
  } catch (error) {
    badge.title = "Could not load the selected spot.";
  }
}

function updateTicket() {
  const ticket = document.getElementById("reservation-summary");
  const startInput = document.getElementById("startTime");
  const endInput = document.getElementById("endTime");

  // These are the three bold values under Date, Time and Duration.
  const [dateText, timeText, durationText] =
    ticket.querySelectorAll(".ticket-details b");
  const amountText = ticket.querySelector(".ticket-total b");
  const payButton = document.querySelector("#payment-form button");

  // Clear old values first so an incomplete date never shows an old price.
  dateText.textContent = "—";
  timeText.textContent = "—";
  durationText.textContent = "—";
  amountText.textContent = "—";
  payButton.textContent = "PAY";

  if (!startInput.value || !endInput.value) return;

  const start = new Date(startInput.value);
  const end = new Date(endInput.value);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return;

  const dateFormat = { day: "numeric", month: "short", year: "numeric" };
  const timeFormat = { hour: "2-digit", minute: "2-digit", hour12: false };

  const startDate = start.toLocaleDateString("en-GB", dateFormat);
  const endDate = end.toLocaleDateString("en-GB", dateFormat);
  dateText.textContent =
    startDate === endDate ? startDate : startDate + " – " + endDate;

  timeText.textContent =
    start.toLocaleTimeString("en-GB", timeFormat) + " – " +
    end.toLocaleTimeString("en-GB", timeFormat);

  const totalMinutes = Math.round((end - start) / 60000);

  if (totalMinutes <= 0) {
    durationText.textContent = "End must be after start";
    return;
  }
  if (totalMinutes > 24 * 60) {
    durationText.textContent = "Maximum 24 hours";
    return;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const duration = [];

  if (hours > 0) duration.push(hours + (hours === 1 ? " hour" : " hours"));
  if (minutes > 0) duration.push(minutes + " min");

  durationText.textContent = duration.join(" ");

  // Use the full duration so a partial hour is priced correctly too.
  const cents = Math.round((totalMinutes / 60) * PRICE_PER_HOUR * 100);
  const price = "€" + (cents / 100).toFixed(2);

  amountText.textContent = price;
  payButton.textContent = "PAY " + price;
}

document.getElementById("startTime").addEventListener("input", updateTicket);
document.getElementById("endTime").addEventListener("input", updateTicket);

updateTicket();
showSelectedSpot();

// Week 4: save the reservation before the driver pays.
const reserveButton = document.getElementById("create-reservation");
const reservationMessage = document.getElementById("reservation-message");

reserveButton.addEventListener("click", async function () {
  const spotId = new URLSearchParams(window.location.search).get("spotId");
  const token = localStorage.getItem("token");
  const startInput = document.getElementById("startTime");
  const endInput = document.getElementById("endTime");
  const start = new Date(startInput.value);
  const end = new Date(endInput.value);

  if (!token || localStorage.getItem("role") !== "driver") {
    reservationMessage.textContent = "Please log in as a driver.";
    return;
  }

  if (!spotId) {
    reservationMessage.textContent = "Please choose a free spot on the dashboard.";
    return;
  }

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    reservationMessage.textContent = "Please choose a start and an end time.";
    return;
  }

  if (end <= start || end - start > 24 * 60 * 60 * 1000) {
    reservationMessage.textContent =
      "Choose an end time after the start and within 24 hours.";
    return;
  }

  // Keep the displayed times consistent with the request while it is saving.
  reserveButton.disabled = true;
  startInput.disabled = true;
  endInput.disabled = true;
  reservationMessage.textContent = "Checking the spot…";

  try {
    // A green spot may have become occupied since the driver selected it.
    const response = await fetch(API_BASE_URL + "/spots", {
      headers: { Authorization: "Bearer " + token },
      cache: "no-store"
    });
    if (!response.ok) throw new Error("Could not check parking availability.");

    const data = await response.json();
    const spot = data.spots.find((item) => item.id === spotId);
    if (!spot || spot.status !== "empty") {
      throw new Error("This spot is no longer free. Please choose another spot.");
    }

    // The backend checks the times and rejects overlapping reservations.
    const result = await postToApi("/reservations", {
      spotId: spotId,
      startTime: start.toISOString(),
      endTime: end.toISOString()
    }, token);

    // The payment step will use the IDs returned by the backend.
    const paymentForm = document.getElementById("payment-form");
    paymentForm.dataset.reservationId = result.reservation.id;
    paymentForm.dataset.paymentId = result.reservation.paymentId;

    reserveButton.textContent = "Reservation created";
    reservationMessage.textContent = result.message;
  } catch (error) {
    reservationMessage.textContent = error.message;
    reserveButton.disabled = false;
    startInput.disabled = false;
    endInput.disabled = false;
  }
});