/**
 * @jest-environment jsdom
 */
const fs = require("fs");
const path = require("path");

const page = fs.readFileSync(
  path.join(__dirname, "../my-reservations.html"),
  "utf8"
);

beforeEach(async () => {
  // Use the real page so the tests exercise its buttons, dropdown and table.
  const html = new DOMParser().parseFromString(page, "text/html");
  document.body.innerHTML = html.body.innerHTML;
  localStorage.setItem("token", "test-driver-token");

  // One paid booking is in the past and one is in the future.
  const reservations = [
    {
      parkingSpotID: { spotLocation: "Lot A - Spot 05" },
      reservationStartTime: "2020-10-26T14:00:00",
      reservationEndTime: "2020-10-26T16:00:00",
      reservationStatus: "Paid",
      paymentID: "payment-05"
    },
    {
      parkingSpotID: { spotLocation: "Lot A - Spot 12" },
      reservationStartTime: "2099-10-28T10:00:00",
      reservationEndTime: "2099-10-28T12:00:00",
      reservationStatus: "Paid",
      paymentID: "payment-12"
    }
  ];

  const payments = [
    { _id: "payment-05", paymentAmount: 4 },
    { _id: "payment-12", paymentAmount: 6 }
  ];

  // Supply sample API replies to the real history.js code.
  global.getFromApi = jest.fn(async (url) => {
    if (url === "/reservations/mine") return reservations;
    if (url === "/payments/mine") return payments;
    throw new Error("Unexpected API path: " + url);
  });

  jest.resetModules();
  require("../js/history.js");

  // Let the page finish loading both replies and drawing the rows.
  await new Promise((resolve) => setTimeout(resolve, 0));
});

afterEach(() => {
  localStorage.clear();
  delete global.getFromApi;
});

function visibleSpots() {
  const rows = document.querySelectorAll("#reservations-table tbody tr");
  return Array.from(rows)
    .filter((row) => !row.hidden)
    .map((row) => row.cells[0].textContent);
}

function clickFilter(label) {
  const buttons = Array.from(document.querySelectorAll("#filters button"));
  buttons.find((button) => button.textContent.trim() === label).click();
}

test("the status filters show bookings with the selected status", () => {
  clickFilter("Completed");
  expect(visibleSpots()).toEqual(["05"]);

  const completedRow = document.querySelector("#reservations-table tbody tr:not([hidden])");
  expect(completedRow.cells[3].textContent).toBe("€4.00");

  clickFilter("Upcoming");
  expect(visibleSpots()).toEqual(["12"]);

  clickFilter("All");
  expect(visibleSpots()).toHaveLength(2);
});

test("changing the date sort switches between oldest and newest first", () => {
  const sort = document.getElementById("date-sort");
  const newestValue = sort.value; // The page starts on Newest first.
  expect(visibleSpots()).toEqual(["12", "05"]);

  sort.value = "oldest";
  sort.dispatchEvent(new Event("change"));
  expect(visibleSpots()).toEqual(["05", "12"]);

  sort.value = newestValue;
  sort.dispatchEvent(new Event("change"));
  expect(visibleSpots()).toEqual(["12", "05"]);
});