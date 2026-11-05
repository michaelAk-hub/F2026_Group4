/**
 * @jest-environment jsdom
 */
// Tests for my 3 pages - Stefania (Week 1)
// Each test loads the html file and checks that the main parts are there

const fs = require("fs");
const path = require("path");

function loadPage(fileName) {
  const filePath = path.join(__dirname, "..", fileName);
  const html = fs.readFileSync(filePath, "utf8");
  document.documentElement.innerHTML = html;
}

// things that all 3 pages must have
const pages = ["dashboard.html", "reservation.html", "my-reservations.html"];

for (let i = 0; i < pages.length; i++) {
  const page = pages[i];

  describe(page, () => {
    beforeEach(() => {
      loadPage(page);
    });

    test("uses tokens.css and layout.css", () => {
      const links = document.querySelectorAll('link[rel="stylesheet"]');
      expect(links.length).toBe(2);
      expect(links[0].getAttribute("href")).toBe("css/tokens.css");
      expect(links[1].getAttribute("href")).toBe("css/layout.css");
    });

    test("menu is in the left sidebar", () => {
      expect(document.querySelector(".sidebar .menu-links")).not.toBeNull();
    });

    test("menu has 4 links and the last one is Logout", () => {
      const links = document.querySelectorAll(".menu-links a");
      expect(links.length).toBe(4);
      expect(links[3].textContent).toBe("Logout");
    });

    test("all menu links go to pages that exist", () => {
      const links = document.querySelectorAll(".menu-links a");
      for (let j = 0; j < links.length; j++) {
        const file = path.join(__dirname, "..", links[j].getAttribute("href"));
        expect(fs.existsSync(file)).toBe(true);
      }
    });

    test("only the current page is active in the menu", () => {
      const active = document.querySelectorAll(".menu-links a.active");
      expect(active.length).toBe(1);
      expect(active[0].getAttribute("href")).toBe(page);
    });
  });
}

describe("dashboard page", () => {
  beforeEach(() => {
    loadPage("dashboard.html");
  });

  test("shows the title", () => {
    expect(document.querySelector("h1").textContent).toBe("Parking Dashboard");
  });

  test("legend has the 4 spot states", () => {
    const buttons = document.querySelectorAll("#legend button");
    expect(buttons[1].textContent).toBe("Empty");
    expect(buttons[2].textContent).toBe("Occupied");
    expect(buttons[3].textContent).toBe("Reserved");
    expect(buttons[4].textContent).toBe("Unknown");
  });

  // Maria (Week 3): dynamic spots are checked in tests/frontend/map.test.cjs.
  test("map starts hidden without example spots", () => {
    const map = document.getElementById("map");
    expect(map).not.toBeNull();
    expect(map.hidden).toBe(true);
    expect(map.querySelectorAll(".spot").length).toBe(0);
  });

  // Maria (Week 3): dynamic spots are checked in tests/frontend/map.test.cjs.
  test("legend keeps the four status colours", () => {
    const states = ["empty", "occupied", "reserved", "unknown"];
    for (const state of states) {
      expect(document.querySelector("#legend span." + state)).not.toBeNull();
    }
  });

  // Maria (Week 3): dynamic spots are checked in tests/frontend/map.test.cjs.
  test("loads the API helper before the map script", () => {
    const scripts = Array.from(document.querySelectorAll("script[src]")).map(
      (s) => s.getAttribute("src"),
    );
    expect(scripts).toContain("js/api.js");
    expect(scripts).toContain("js/map.js");
    expect(scripts.indexOf("js/api.js")).toBeLessThan(
      scripts.indexOf("js/map.js"),
    );
  });

  // Maria (Week 3): dynamic spots are checked in tests/frontend/map.test.cjs.
  test("map has a loading message for API updates", () => {
    expect(document.getElementById("map-message").textContent).toContain(
      "Loading",
    );
    expect(document.getElementById("map-message").getAttribute("role")).toBe(
      "status",
    );
    expect(
      document.getElementById("map-message").getAttribute("aria-live"),
    ).toBe("polite");
  });

  // Maria (Week 3): dynamic spots are checked in tests/frontend/map.test.cjs.
  test("summary waits for real API values", () => {
    const numbers = document.querySelectorAll("#summary .numbers b");
    expect(numbers.length).toBe(4);
    for (const number of numbers) {
      expect(number.textContent).toBe("—");
    }
  });

  test("reserve button goes to the reservation page", () => {
    const button = document.querySelector("#quick-actions a.btn");
    expect(button.getAttribute("href")).toBe("reservation.html");
  });
});

describe("reservation page", () => {
  beforeEach(() => {
    loadPage("reservation.html");
  });

  test("summary is a ticket with the spot, date, time, duration and total", () => {
    const ticket = document.getElementById("reservation-summary");
    expect(ticket.classList.contains("ticket")).toBe(true);
    expect(ticket.querySelector(".ticket-spot").textContent).toBe("05");
    expect(ticket.textContent).toContain("Date");
    expect(ticket.textContent).toContain("Time");
    expect(ticket.textContent).toContain("Duration");
    expect(ticket.textContent).toContain("Total amount");
  });

  test("Back link goes to the dashboard", () => {
    const back = document.querySelector("#payment-form .back-btn");
    expect(back.getAttribute("href")).toBe("dashboard.html");
  });

  test("payment form has the 4 card fields with labels", () => {
    const ids = ["cardName", "cardNumber", "expiry", "cvv"];
    for (let i = 0; i < ids.length; i++) {
      expect(document.getElementById(ids[i])).not.toBeNull();
      expect(
        document.querySelector('label[for="' + ids[i] + '"]'),
      ).not.toBeNull();
    }
  });

  test("has a pay button", () => {
    const button = document.querySelector("#payment-form button");
    expect(button.textContent).toContain("PAY");
  });
});

describe("my reservations page", () => {
  beforeEach(() => {
    loadPage("my-reservations.html");
  });

  test("has 4 filter buttons", () => {
    const buttons = document.querySelectorAll("#filters .filter-btn");
    expect(buttons.length).toBe(4);
    expect(buttons[0].textContent).toBe("All");
  });

  test("table has 5 columns", () => {
    const headers = document.querySelectorAll("#reservations-table th");
    expect(headers.length).toBe(5);
  });

  test("every row has 5 cells", () => {
    const rows = document.querySelectorAll("#reservations-table tbody tr");
    for (let i = 0; i < rows.length; i++) {
      expect(rows[i].querySelectorAll("td").length).toBe(5);
    }
  });

  test("no reservations message is hidden when there are rows", () => {
    const message = document.getElementById("empty-message");
    expect(message.hidden).toBe(true);
  });
});
