/** @jest-environment jsdom */

const fs = require("fs");
const path = require("path");

test("loads parking spots and asks for the missing coordinate", async () => {
  const html = fs.readFileSync(
    path.join(__dirname, "../admin-sensors.html"),
    "utf8"
  );
  document.body.innerHTML = new DOMParser()
    .parseFromString(html, "text/html").body.innerHTML;

  // Simulate an admin session and the backend's parking spot response.
  global.whereToGo = jest.fn(() => null);
  global.getFromApi = jest.fn().mockResolvedValue({
    spots: [{ id: "spot-01", location: "Lot A - Spot 01" }]
  });

localStorage.setItem("token", "test-admin-token");
global.requestApi = jest.fn().mockResolvedValue({});
const { renderSensorRows } = require("../js/admin-sensors.js");
  await Promise.resolve();
    const onDelete = jest.fn();
    renderSensorRows([
    {
      spotId: "spot-01",
      spotLocation: "Lot A - Spot 01",
      coordinates: "35, 33",
      availability: "Available"
    }
  ], onDelete);

  const row = document.querySelector("#sensor-table tbody tr");
  expect(Array.from(row.cells, (cell) => cell.textContent)).toEqual([
    "Lot A - Spot 01", "35, 33", "Available", "EditDelete"  ]);

  document.getElementById("add-sensor").click();
  expect(document.getElementById("sensor-editor").hidden).toBe(false);

  const spot = document.getElementById("sensor-spot");
  spot.value = "spot-01";
  expect(spot.selectedOptions[0].textContent).toBe("Lot A - Spot 01");

  document.getElementById("sensor-latitude").value = "35";
  const save = document.querySelector("#sensor-form button[type='submit']");
  save.click();
  expect(document.getElementById("sensor-form-error").textContent)
    .toContain("Enter both latitude and longitude");

  document.getElementById("sensor-longitude").value = "33";
  save.click();
  expect(document.getElementById("sensor-form-error").textContent).toBe("");
expect(global.requestApi).toHaveBeenCalledWith(
  "POST",
  "/sensors",
  { spotId: "spot-01", coordinates: "35,33" },
  "test-admin-token"
);

spot.value = "";
document.getElementById("sensor-latitude").value = "";
document.getElementById("sensor-longitude").value = "";

  row.querySelector("button").click();

  expect(document.getElementById("sensor-editor-title").textContent)
    .toBe("Edit sensor");
  expect(spot.value).toBe("spot-01");
  expect(document.getElementById("sensor-latitude").value).toBe("35");
  expect(document.getElementById("sensor-longitude").value).toBe("33");

  document.getElementById("cancel-sensor").click();
  const editor = document.getElementById("sensor-editor");
  expect(editor.hidden).toBe(true);

  document.getElementById("add-sensor").click();
  expect(editor.hidden).toBe(false);
  expect(document.getElementById("sensor-editor-title").textContent)
    .toBe("Add sensor");
  expect(spot.value).toBe("");
  expect(document.getElementById("sensor-latitude").value).toBe("");
  expect(document.getElementById("sensor-longitude").value).toBe("");

  const deleteButton = row.querySelector("button:last-child");
  const confirmDelete = jest.spyOn(window, "confirm");

  confirmDelete.mockReturnValue(false);
  deleteButton.click();
  expect(onDelete).not.toHaveBeenCalled();

  confirmDelete.mockReturnValue(true);
  deleteButton.click();
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(onDelete).toHaveBeenCalledWith(
    expect.objectContaining({ spotId: "spot-01" })
  );

  confirmDelete.mockRestore();

    const latitude = document.getElementById("sensor-latitude");
  const longitude = document.getElementById("sensor-longitude");

  latitude.value = "91";
  expect(latitude.checkValidity()).toBe(false);
  latitude.value = "90";
  expect(latitude.checkValidity()).toBe(true);

  longitude.value = "181";
  expect(longitude.checkValidity()).toBe(false);
  longitude.value = "180";
  expect(longitude.checkValidity()).toBe(true);
});