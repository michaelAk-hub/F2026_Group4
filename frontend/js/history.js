// Week 5: Filter the reservations table by status.
const filters = document.getElementById("filters");
const tableBody = document.querySelector("#reservations-table tbody");

function filterReservations(selectedButton) {
  const selectedStatus = selectedButton.textContent.trim();

  for (const button of filters.querySelectorAll("button")) {
    const isSelected = button === selectedButton;
    button.classList.toggle("active", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  }

  for (const row of tableBody.rows) {
    const rowStatus = row.cells[4].textContent.trim();
    row.hidden = selectedStatus !== "All" && rowStatus !== selectedStatus;
  }
}

for (const button of filters.querySelectorAll("button")) {
  button.addEventListener("click", () => filterReservations(button));
}

filterReservations(filters.querySelector(".active"));
const dateSort = document.getElementById("date-sort");

function sortReservationsByDate() {
  const rows = Array.from(tableBody.rows);

  // The second cell in each row contains the reservation date.
  rows.sort((rowA, rowB) => {
    const dateA = Date.parse(rowA.cells[1].textContent.trim());
    const dateB = Date.parse(rowB.cells[1].textContent.trim());

    if (dateSort.value === "oldest") {
      return dateA - dateB;
    }
    return dateB - dateA;
  });

  // Move the existing rows so the active status filter still applies.
  for (const row of rows) {
    tableBody.appendChild(row);
  }
}

dateSort.addEventListener("change", sortReservationsByDate);
sortReservationsByDate();

async function showMyHistory() {
  const message = document.getElementById("empty-message");
  message.hidden = false;
  message.textContent = "Loading your reservation history…";

  try {
    const { reservations, payments } = await loadMyHistory();

    // Accept a list directly or a response containing a reservations list.
    const list = Array.isArray(reservations)
      ? reservations
      : reservations?.reservations;

    if (!Array.isArray(list)) {
      throw new Error("Unexpected reservation history format.");
    }

    tableBody.replaceChildren();

if (list.length === 0) {
  message.textContent = "You have no reservations yet.";
  return;
}

const paymentList = Array.isArray(payments) ? payments : payments?.payments;
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit", month: "short", year: "numeric"
});
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit", minute: "2-digit"
});
const now = new Date();

for (const reservation of list) {
  const start = new Date(reservation.reservationStartTime);
  const end = new Date(reservation.reservationEndTime);

  // The API may send the payment details or an ID linking to the payment list.
  const paymentRef = reservation.paymentID;
  const paymentId = paymentRef?._id ?? paymentRef;
  const payment = paymentList?.find(item => item._id === paymentId) ?? paymentRef;
  const amount = typeof payment?.paymentAmount === "number"
    ? `€${payment.paymentAmount.toFixed(2)}`
    : "—";

  // Paid and Unpaid describe payment. The dates tell us when parking takes place.
  let status = reservation.reservationStatus;
  if (status === "Paid") {
    if (now < start) status = "Upcoming";
    else if (now < end) status = "In progress";
    else status = "Completed";
  }

  addHistoryRow(
    formatSpotLabel(reservation.parkingSpotID?.spotLocation),
    dateFormat.format(start),
    `${timeFormat.format(start)} - ${timeFormat.format(end)}`,
    amount,
    status
  );
}

// Apply the driver's current choices to the newly loaded rows.
sortReservationsByDate();
filterReservations(filters.querySelector(".active"));
message.hidden = true;
  } catch (error) {
    message.textContent = "Couldn’t load your reservation history. Please try again later.";
  }
}

showMyHistory();
// Use the same spot label as the dashboard.
function formatSpotLabel(location) {
  if (typeof location !== "string" || !location.trim()) {
    return "Unknown spot";
  }

  const match = location.match(/ - Spot (\d+)$/);
  return match ? match[1] : location;
}
// Load the signed-in driver's reservation and payment history.
async function loadMyHistory() {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("Please log in to view your reservation history.");
  }

  const [reservations, payments] = await Promise.all([
    getFromApi("/reservations/mine", token),
    getFromApi("/payments/mine", token)
  ]);

  return { reservations, payments };
}

// Add one reservation to the five columns in My Reservations.
function addHistoryRow(spot, date, time, amount, status) {
  const row = tableBody.insertRow();

  for (const value of [spot, date, time, amount, status]) {
    const cell = row.insertCell();
    cell.textContent = value;
  }
}