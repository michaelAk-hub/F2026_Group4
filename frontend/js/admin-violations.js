(() => {
  if (whereToGo("admin") !== null) {
    requireRole("admin");
    return;
  }

  const token = localStorage.getItem("token");
  const list = document.getElementById("violations-list");
  const table = document.getElementById("violations-table");
  const heading = document.getElementById("open-violations-title");
  const statusMessage = document.getElementById("violations-status");
  const retry = document.getElementById("retry-violations");
  const review = document.getElementById("violation-review");
  const details = document.getElementById("review-details");
  const form = document.getElementById("violation-review-form");
  const note = document.getElementById("violation-note");
  const reviewError = document.getElementById("violation-review-error");

  let selectedId = null;
  let reviewButton = null;
  let saving = false;

  function closeReview(focusTarget) {
    selectedId = null;
    reviewButton = null;
    review.hidden = true;
    form.reset();
    reviewError.textContent = "";
    focusTarget.focus();
  }

  function addViolationRow(violation) {
    const row = list.insertRow();
    const spot = violation.spotLocation ?? "Unknown spot";
    const type = violation.type ?? "Unknown violation";
    const timestamp = Date.parse(violation.date);
    const date = Number.isNaN(timestamp)
      ? "Unknown date"
      : new Date(timestamp).toLocaleString();

    row.insertCell().textContent = spot;
    row.insertCell().textContent = type;
    row.insertCell().textContent = date;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-btn";
    button.textContent = "Review";
        button.disabled = violation.id == null;
    button.addEventListener("click", () => {
      if (saving) return;

      selectedId = violation.id;
      reviewButton = button;
      details.textContent = `${spot} — ${type} — ${date}`;
      form.reset();
      reviewError.textContent = "";
      review.hidden = false;
      note.focus();
    });

    row.insertCell().append(button);
  }

  async function loadViolations() {
    table.hidden = true;
    retry.hidden = true;
    list.replaceChildren();
    statusMessage.textContent = "Loading violations…";

    try {
      const result = await getFromApi("/violations", token);
           const violations = result?.violations;

      if (!Array.isArray(violations)) {
        throw new Error("The server did not return a list of violations.");
      }

      // The server returns only open violations by default.
      violations.forEach(addViolationRow);
      table.hidden = violations.length === 0;
      statusMessage.textContent = violations.length ? "" : "There are no open violations.";
    } catch (error) {
      statusMessage.textContent = "Could not load violations. " + error.message;
      retry.hidden = false;
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (saving || selectedId === null || !event.submitter) return;

    const reviewNote = note.value.trim();
    if (!reviewNote) {
      reviewError.textContent = "Enter a review note.";
      note.focus();
      return;
    }

    saving = true;
    reviewError.textContent = "";
    const controls = [...form.elements];
    controls.forEach(control => { control.disabled = true; });

    try {
      // Confirm the request fields and accepted statuses against the backend route.
    await requestApi("PUT", "/violations/" + encodeURIComponent(selectedId), {
  status: event.submitter.value,
  note: reviewNote
}, token);

      closeReview(heading);
      await loadViolations();
    } catch (error) {
      reviewError.textContent = "Could not save the review. " + error.message;
    } finally {
      saving = false;
      controls.forEach(control => { control.disabled = false; });
      if (!review.hidden) note.focus();
    }
  });

  retry.addEventListener("click", loadViolations);
  document.getElementById("cancel-review").addEventListener("click", () => {
    closeReview(reviewButton);
  });

  loadViolations();
})();