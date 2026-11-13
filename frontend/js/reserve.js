// Reservation page — Maria Antoniou
const PRICE_PER_HOUR = 2;
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

const bookingTimes = document.getElementById("booking-times");
const bookingError = document.getElementById("booking-error");
const startDateInput = document.getElementById("startDate");
const endDateInput = document.getElementById("endDate");
const reserveButton = document.getElementById("create-reservation");
const reservationMessage = document.getElementById("reservation-message");
const spotId = new URLSearchParams(window.location.search).get("spotId");

// The calendar needs the driver's local date in YYYY-MM-DD format.
function localDay(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Fill each scrollable list and select its starting value.
function fillTimeList(id, count, selected) {
  const list = document.getElementById(id);

  for (let i = 0; i < count; i++) {
    const text = String(i).padStart(2, "0");
    list.add(new Option(text, text));
  }

  list.selectedIndex = selected;
}

// Combine the chosen local date, hour and minute.
function readTime(prefix) {
  const date = document.getElementById(prefix + "Date").value;
  const hour = document.getElementById(prefix + "Hour").value;
  const minute = document.getElementById(prefix + "Minute").value;
  const time = new Date(date + "T" + hour + ":" + minute);

  // A local time can be skipped when clocks move forward.
  if (
    localDay(time) !== date ||
    time.getHours() !== Number(hour) ||
    time.getMinutes() !== Number(minute)
  ) {
    return new Date(NaN);
  }

  return time;
}

function checkTimes(start, end, now) {
  if (!Number.isFinite(start.getTime())) {
    return "Choose a valid start date and time.";
  }
  if (start < now) {
    return "The start is in the past. Choose the current time or later.";
  }
  if (!Number.isFinite(end.getTime())) {
    return "Choose a valid end date and time.";
  }
  if (end <= start) {
    return "Choose an end date and time after the start.";
  }
  if (end - start > DAY) {
    return "A reservation can last up to 24 hours.";
  }
  return "";
}

function updateTicket() {
  const start = readTime("start");
  const end = readTime("end");
  const now = new Date();
  now.setSeconds(0, 0); // The controls let the driver choose whole minutes.

  startDateInput.min = localDay(now);
  endDateInput.min =
    startDateInput.value > startDateInput.min
      ? startDateInput.value
      : startDateInput.min;

  const ticket = document.getElementById("reservation-summary");
  const [dateText, timeText, durationText] =
    ticket.querySelectorAll(".ticket-details b");
  const amountText = ticket.querySelector(".ticket-total b");
  const payButton = document.getElementById("pay-button");

  bookingError.textContent = checkTimes(start, end, now);

  if (bookingError.textContent) {
    dateText.textContent = "—";
    timeText.textContent = "—";
    durationText.textContent = "—";
    amountText.textContent = "—";
    payButton.textContent = "PAY";
    return false;
  }

  const dateFormat = { day: "numeric", month: "short", year: "numeric" };
  const timeFormat = { hour: "2-digit", minute: "2-digit", hour12: false };
  const startDay = start.toLocaleDateString("en-GB", dateFormat);
  const endDay = end.toLocaleDateString("en-GB", dateFormat);

  dateText.textContent =
    startDay === endDay ? startDay : startDay + " – " + endDay;
  timeText.textContent =
    start.toLocaleTimeString("en-GB", timeFormat) + " – " +
    end.toLocaleTimeString("en-GB", timeFormat);

  const totalMinutes = Math.round((end - start) / MINUTE);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const duration = [];

  if (hours > 0) duration.push(hours + (hours === 1 ? " hour" : " hours"));
  if (minutes > 0) duration.push(minutes + " min");

  durationText.textContent = duration.join(" ");

  const cents = Math.round((totalMinutes / 60) * PRICE_PER_HOUR * 100);
  const price = "€" + (cents / 100).toFixed(2);
  amountText.textContent = price;
  payButton.textContent = "PAY " + price;
  return true;
}

async function getSelectedSpot() {
  const response = await fetch(API_BASE_URL + "/spots", {
    headers: { Authorization: "Bearer " + localStorage.getItem("token") },
    cache: "no-store"
  });

  if (!response.ok) throw new Error("Could not check parking availability.");

  const data = await response.json();
  return data.spots.find((spot) => spot.id === spotId);
}

async function showSelectedSpot() {
  const badge = document.querySelector(".ticket-spot");
  badge.textContent = "—";

  if (!spotId) {
    badge.title = "Choose a spot on the dashboard.";
    return;
  }

  try {
    const spot = await getSelectedSpot();
    if (!spot) {
      badge.title = "This spot is no longer listed.";
      return;
    }

    const match = spot.location.match(/ - Spot (\d+)$/);
    badge.textContent = match ? match[1] : spot.location;
    badge.title = spot.location;
  } catch (error) {
    badge.title = "Could not load the selected spot.";
  }
}

// Open with a two-hour booking. The end date can be tomorrow.
const initialStart = new Date();
const initialEnd = new Date(initialStart.getTime() + 2 * 60 * MINUTE);

for (const [prefix, time] of [["start", initialStart], ["end", initialEnd]]) {
  document.getElementById(prefix + "Date").value = localDay(time);
  fillTimeList(prefix + "Hour", 24, time.getHours());
  fillTimeList(prefix + "Minute", 60, time.getMinutes());
}

bookingTimes.addEventListener("input", function () {
  reservationMessage.textContent = "";
  updateTicket();
});

bookingTimes.addEventListener("focusin", updateTicket);
updateTicket();
showSelectedSpot();

reserveButton.addEventListener("click", async function () {
  // Check again in case time passed while the page was open.
  if (!updateTicket()) return;

  const token = localStorage.getItem("token");
  if (!token || localStorage.getItem("role") !== "driver") {
    reservationMessage.textContent = "Please log in as a driver.";
    return;
  }

  if (!spotId) {
    reservationMessage.textContent = "Please choose a free spot on the dashboard.";
    return;
  }

  const start = readTime("start");
  const end = readTime("end");

  reserveButton.disabled = true;
  bookingTimes.disabled = true;
  reservationMessage.textContent = "Checking the spot…";

  try {
    const spot = await getSelectedSpot();
    if (!spot || spot.status !== "empty") {
      throw new Error("This spot is no longer free. Please choose another spot.");
    }

    const result = await postToApi("/reservations", {
      spotId: spotId,
      startTime: start.toISOString(),
      endTime: end.toISOString()
    }, token);

    // The payment form uses these IDs to finish the booking.
    const form = document.getElementById("payment-form");
    form.dataset.reservationId = result.reservation.id;
    form.dataset.paymentId = result.reservation.paymentId;

    bookingTimes.hidden = true;
    reserveButton.textContent = "Reservation created";

    reserveButton.textContent = "Reservation created";
    reservationMessage.textContent = result.message;
  } catch (error) {
    reservationMessage.textContent = error.message;
    reserveButton.disabled = false;
    bookingTimes.disabled = false;
  }
});