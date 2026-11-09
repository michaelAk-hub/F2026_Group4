// Maria Antoniou - parking map tests.
// Run from the repository root: node --test tests/frontend/map.test.cjs
// These tests simulate the page, API responses, timers and stream events.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "../../frontend/js/map.js"),
  "utf8",
);

class Element {
  constructor(fragment = false) {
    this.fragment = fragment;
    this.children = [];
    this.dataset = {};
    this.hidden = false;
    this.className = "";
    this.textContent = "";
    this.attributes = {};
  }

  appendChild(child) {
    if (child.fragment) this.children.push(...child.children);
    else this.children.push(child);
  }

  append(...children) {
    for (const child of children) this.appendChild(child);
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }
}

function setup(fetch) {
  const elements = { map: new Element(), "map-message": new Element() };
  elements.map.hidden = true;
  elements["map-message"].textContent = "Loading parking spots...";

  const numbers = Array.from({ length: 4 }, () => {
    const element = new Element();
    element.textContent = "—";
    return element;
  });

  const saved = {};
  const intervals = new Map();
  const timeouts = new Map();
  const events = {};
  let nextId = 0;

  const context = vm.createContext({
    API_BASE_URL: "http://localhost:3000/api",
    AbortController,
    fetch,
    localStorage: { getItem: (key) => saved[key] || null },

    setInterval: (fn, ms) => {
      const id = ++nextId;
      intervals.set(id, { fn, ms });
      return id;
    },
    clearInterval: (id) => intervals.delete(id),

    setTimeout: (fn, ms) => {
      const id = ++nextId;
      timeouts.set(id, { fn, ms });
      return id;
    },
    clearTimeout: (id) => timeouts.delete(id),

    window: {
      addEventListener: (name, fn) => {
        events[name] = fn;
      },
    },

    document: {
      getElementById: (id) => elements[id],
      querySelectorAll: (selector) => {
        assert.equal(selector, "#summary .numbers b");
        return numbers;
      },
      createElement: () => new Element(),
      createDocumentFragment: () => new Element(true),
    },
  });

  vm.runInContext(source, context);

  const login = () => {
    saved.token = "test-token";
    saved.role = "driver";
  };

  const load = () => {
    login();
    context.mapActive = true;
    return context.loadParkingMap();
  };

  return {
    context,
    elements,
    numbers,
    saved,
    intervals,
    timeouts,
    events,
    login,
    load,
  };
}

function dataFor(statuses) {
  const counts = { empty: 0, occupied: 0, reserved: 0, unknown: 0 };

  const spots = statuses.map((status, i) => {
    counts[status]++;
    return {
      id: "spot-" + i,
      location: "Lot A - Spot " + String(i + 1).padStart(2, "0"),
      status,
      coordinates: null,
    };
  });

  return { total: spots.length, counts, spots };
}

function reply(data, ok = true) {
  return { ok, json: async () => data };
}

function tiles(page) {
  return page.elements.map.children
    .filter((element) => element.className.includes("parking-row"))
    .flatMap((row) => row.children);
}

test("GET /spots sends the saved token and requests fresh data", async () => {
  const page = setup(async (url, options) => {
    assert.equal(url, "http://localhost:3000/api/spots");
    assert.equal(options.headers.Authorization, "Bearer test-token");
    assert.equal(options.cache, "no-store");
    assert.ok(options.signal);
    return reply(dataFor(["empty", "occupied", "reserved", "unknown"]));
  });

  await page.load();

  assert.deepEqual(
    tiles(page).map((tile) => tile.className),
    ["spot empty", "spot occupied", "spot reserved", "spot unknown"],
  );
  assert.deepEqual(
    page.numbers.map((number) => Number(number.textContent)),
    [4, 1, 1, 1],
  );
  assert.equal(page.elements.map.hidden, false);
  assert.equal(tiles(page)[0].dataset.spotId, "spot-0");
  assert.equal(tiles(page)[0].textContent, "01");
});

test("20 spots keep two rows of 10 with a driving lane between them", async () => {
  const page = setup(async () => reply(dataFor(Array(20).fill("empty"))));
  await page.load();

  assert.deepEqual(
    page.elements.map.children.map((element) => element.className),
    ["parking-row top-row", "driving-lane", "parking-row bottom-row"],
  );
  assert.equal(page.elements.map.children[0].children.length, 10);
  assert.equal(page.elements.map.children[2].children.length, 10);
});

test("the map supports more than 20 spots without losing any (RQ32)", async () => {
  const page = setup(async () => reply(dataFor(Array(23).fill("empty"))));
  await page.load();

  assert.equal(tiles(page).length, 23);
  assert.equal(page.elements.map.children.at(-1).children.length, 3);
});

test("coordinates from the API are included in the spot title and accessible label", async () => {
  const data = dataFor(["empty"]);
  data.spots[0].coordinates = "35.1,33.3";
  const page = setup(async () => reply(data));
  await page.load();

  const tile = tiles(page)[0];
  assert.match(tile.title, /35.1,33.3/);
  assert.equal(tile.attributes["aria-label"], tile.title);
});

test("missing coordinates are not replaced with invented locations", async () => {
  const page = setup(async () => reply(dataFor(["empty"])));
  await page.load();

  assert.match(tiles(page)[0].title, /Coordinates: unavailable/);
});

test("zero spots hides the map and shows zero totals and a message", async () => {
  const page = setup(async () => reply(dataFor([])));
  await page.load();

  assert.equal(page.elements.map.hidden, true);
  assert.match(page.elements["map-message"].textContent, /No parking spots/);
  assert.deepEqual(
    page.numbers.map((number) => Number(number.textContent)),
    [0, 0, 0, 0],
  );
});

// Run the same first-load checks for each kind of invalid response.
for (const [name, fetch] of [
  ["HTTP failure", async () => reply({ message: "Unavailable" }, false)],
  [
    "connection failure",
    async () => {
      throw Error("offline");
    },
  ],
  [
    "invalid JSON",
    async () => ({
      ok: true,
      json: async () => {
        throw Error("bad JSON");
      },
    }),
  ],
  ["unexpected reply", async () => reply({ spots: [] })],
  [
    "inconsistent totals",
    async () => reply({ ...dataFor(["empty"]), total: 9 }),
  ],
  [
    "invalid state",
    async () => {
      const data = dataFor(["empty"]);
      data.spots[0].status = "fake";
      return reply(data);
    },
  ],
  [
    "duplicate spot IDs",
    async () => {
      const data = dataFor(["empty", "empty"]);
      data.spots[1].id = data.spots[0].id;
      return reply(data);
    },
  ],
]) {
  test(
    name + " on the first request shows an error without fake availability",
    async () => {
      const page = setup(fetch);
      await page.load();

      assert.equal(page.elements.map.hidden, true);
      assert.equal(tiles(page).length, 0);
      assert.match(page.elements["map-message"].textContent, /Cannot load/);
      assert.ok(page.numbers.every((number) => number.textContent === "—"));
      assert.equal(page.context.mapLoading, false);
      assert.equal(page.timeouts.size, 0);
    },
  );
}

test("a failed refresh preserves the latest known status with a warning (UC03)", async () => {
  let calls = 0;
  const page = setup(async () => {
    if (++calls > 1) throw Error("offline");
    return reply(dataFor(["empty"]));
  });

  await page.load();
  await page.load();

  assert.equal(tiles(page)[0].className, "spot empty");
  assert.match(page.elements["map-message"].textContent, /latest known/);
  assert.equal(page.elements.map.hidden, false);
});

test("start creates one 2-second refresh timer and later updates colours and totals", async () => {
  let calls = 0;
  const page = setup(async () =>
    reply(dataFor([++calls === 1 ? "empty" : "occupied"])),
  );

  page.login();
  await page.context.startParkingMap();
  page.context.startParkingMap();

  assert.equal(page.intervals.size, 1);
  const timer = [...page.intervals.values()][0];
  assert.equal(timer.ms, 2000);
  await timer.fn();

  assert.equal(tiles(page)[0].className, "spot occupied");
  assert.deepEqual(
    page.numbers.map((number) => Number(number.textContent)),
    [1, 0, 1, 0],
  );
  assert.equal(tiles(page).length, 1);
});

test("automatic refresh recovers after an error and clears the warning", async () => {
  let calls = 0;
  const page = setup(async () => {
    if (++calls === 1) throw Error("offline");
    return reply(dataFor(["reserved"]));
  });

  page.login();
  await page.context.startParkingMap();
  assert.match(page.elements["map-message"].textContent, /Cannot load/);

  await [...page.intervals.values()][0].fn();

  assert.equal(tiles(page)[0].className, "spot reserved");
  assert.equal(page.elements["map-message"].textContent, "");
});

test("a backend Unknown state replaces the previous known status (RQ28)", async () => {
  let calls = 0;
  const page = setup(async () =>
    reply(dataFor([++calls === 1 ? "empty" : "unknown"])),
  );

  await page.load();
  await page.load();

  assert.equal(tiles(page)[0].className, "spot unknown");
  assert.equal(page.numbers[1].textContent, 0);
});

test("a request already running is not overlapped", async () => {
  let finish;
  let calls = 0;
  const page = setup(() => {
    calls++;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });

  const pending = page.load();
  await page.context.loadParkingMap();

  assert.equal(calls, 1);
  finish(reply(dataFor(["empty"])));
  await pending;
});

test("a stalled request is aborted after 2 seconds and later loads can recover", async () => {
  let calls = 0;
  const page = setup((url, options) => {
    if (++calls > 1) return Promise.resolve(reply(dataFor(["empty"])));

    return new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(Error("aborted")));
    });
  });

  const pending = page.load();
  const timeout = [...page.timeouts.values()][0];
  assert.equal(timeout.ms, 2000);
  timeout.fn();
  await pending;

  assert.equal(page.context.mapLoading, false);
  await page.load();
  assert.equal(tiles(page).length, 1);
});

test("leaving the page stops the timer and aborts a pending request", async () => {
  let signal;
  const page = setup((url, options) => {
    signal = options.signal;
    return new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(Error("aborted")));
    });
  });

  page.login();
  const pending = page.context.startParkingMap();
  page.events.pagehide();
  await pending;

  assert.equal(page.intervals.size, 0);
  assert.equal(signal.aborted, true);
  assert.equal(page.context.mapActive, false);
});

test("restoring the page restarts updates with one timer", async () => {
  const page = setup(async () => reply(dataFor(["empty"])));
  page.login();

  await page.context.startParkingMap();
  page.events.pagehide();
  await page.events.pageshow();

  assert.equal(page.intervals.size, 1);
});

test("logged-out users and admins do not start the driver map", () => {
  let calls = 0;
  const page = setup(() => {
    calls++;
  });

  page.context.startParkingMap();
  page.saved.token = "test-token";
  page.saved.role = "admin";
  page.context.startParkingMap();

  assert.equal(calls, 0);
  assert.equal(page.intervals.size, 0);
});

test("removing login data stops refreshes and hides previous map data", async () => {
  const page = setup(async () => reply(dataFor(["empty"])));
  page.login();
  await page.context.startParkingMap();

  delete page.saved.token;
  await [...page.intervals.values()][0].fn();

  assert.equal(page.intervals.size, 0);
  assert.equal(page.elements.map.hidden, true);
  assert.equal(tiles(page).length, 0);
  assert.match(page.elements["map-message"].textContent, /Please log in/);
});

test("location text cannot create HTML elements", async () => {
  const data = dataFor(["empty"]);
  data.spots[0].location = "<img src=x onerror=alert(1)>";
  const page = setup(async () => reply(data));
  await page.load();

  assert.equal(tiles(page)[0].textContent, data.spots[0].location);
  assert.equal(tiles(page)[0].children.length, 0);
});

test("live snapshot, changed spots, removal and reconnect update the map", () => {
  const page = setup(() => {
    throw new Error("Unexpected fetch");
  });

  // Simulate the browser's EventSource so we can send specific events.
  let stream;
  page.context.EventSource = class {
    constructor(url) {
      assert.equal(url, "http://localhost:3000/api/spots/stream");
      stream = this;
    }

    addEventListener(name, handler) {
      this[name] = handler;
    }

    close() {
      this.closed = true;
    }
  };

  page.login();
  page.context.startParkingMap();
  assert.equal(page.intervals.size, 0);

  // The driver first sees all three spots.
  const initial = dataFor(["empty", "occupied", "unknown"]);
  stream.snapshot({ type: "snapshot", data: JSON.stringify(initial) });
  assert.equal(tiles(page).length, 3);

  // Spot 0 changes, spot 1 stays occupied, and spot 2 is removed.
  const after = dataFor(["reserved", "occupied"]);
  stream.update({
    type: "update",
    data: JSON.stringify({
      total: 2,
      counts: after.counts,
      spots: [after.spots[0]],
      removed: ["spot-2"],
    }),
  });

  assert.deepEqual(
    tiles(page).map((tile) => tile.className),
    ["spot reserved", "spot occupied"],
  );
  assert.deepEqual(
    page.numbers.map((number) => Number(number.textContent)),
    [2, 0, 1, 1],
  );

  // A temporary interruption shows a warning and preserves the visible map.
  stream.readyState = 0;
  stream.onerror();
  assert.match(page.elements["map-message"].textContent, /interrupted/);
  assert.equal(tiles(page).length, 2);

  // After reconnecting, a new snapshot replaces the old map.
  stream.snapshot({ type: "snapshot", data: JSON.stringify(dataFor([])) });
  assert.equal(page.elements.map.hidden, true);
  assert.match(page.elements["map-message"].textContent, /No parking spots/);

  page.events.pagehide();
  assert.equal(stream.closed, true);
});