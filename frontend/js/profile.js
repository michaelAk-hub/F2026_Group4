// Profile page - Stefania (Week 5)
// Shows the driver's personal and payment details and saves the changes (RQ12, RQ13).
// It uses the profile API of Michalis: GET /api/me and PUT /api/me.
// Other files it uses: api.js (requestApi, Maria), validators.js (isValidEmail,
// isValidCarNumber, Maria) and toast.js (showToast).

// the same rules as the server, so the driver sees the mistake before saving
function validateProfile(data) {
  var errors = {};

  if (data.name.trim().length < 2) {
    errors.name = "Name must have at least 2 characters.";
  }
  if (!isValidEmail(data.email)) {
    errors.email = "Enter a valid email address.";
  }
  if (!isValidCarNumber(data.carNumber)) {
    errors.carNumber = "Use 3 letters and 3 numbers: ABC123 or ABC 123.";
  }

  // the payment method is optional, but it must never be a card number (PCI-DSS)
  var method = data.paymentMethod.trim();
  if (/[0-9]{5,}/.test(method.replace(/[ -]/g, ""))) {
    errors.paymentMethod = "Do not write your card number. Use a short name such as \"Visa ending 4242\".";
  } else if (method.length > 40) {
    errors.paymentMethod = "The payment method can have at most 40 characters.";
  }

  return { valid: Object.keys(errors).length === 0, errors: errors };
}

// read the 4 inputs of the form
function readProfileForm() {
  return {
    name: document.getElementById("name").value,
    email: document.getElementById("email").value,
    carNumber: document.getElementById("carNumber").value,
    paymentMethod: document.getElementById("paymentMethod").value
  };
}

// put the profile from the server into the form
function fillProfileForm(user) {
  document.getElementById("name").value = user.name || "";
  document.getElementById("email").value = user.email || "";
  document.getElementById("carNumber").value = user.carNumber || "";
  document.getElementById("paymentMethod").value = user.paymentMethod || "";
}

// write the error under each field (empty text = no error)
function showProfileErrors(errors) {
  var boxes = document.querySelectorAll("#profile-form .error");
  for (var i = 0; i < boxes.length; i++) {
    boxes[i].textContent = errors[boxes[i].dataset.for] || "";
  }
}

// GET /api/me when the page opens
async function loadProfile() {
  try {
    var result = await requestApi("GET", "/me", undefined, localStorage.getItem("token"));
    fillProfileForm(result.user);
    return true;
  } catch (error) {
    showToast(error.message, "error");
    return false;
  }
}

// PUT /api/me when the driver clicks SAVE CHANGES. Gives back true when it was saved.
async function saveProfile() {
  var data = readProfileForm();
  var result = validateProfile(data);
  showProfileErrors(result.errors);
  if (!result.valid) {
    showToast("Please fix the highlighted fields.", "error");
    return false;
  }

  // an empty payment method means "remove it"
  var method = data.paymentMethod.trim();
  data.paymentMethod = method === "" ? null : method;

  var button = document.getElementById("save-profile");
  button.disabled = true;

  try {
    var saved = await requestApi("PUT", "/me", data, localStorage.getItem("token"));
    fillProfileForm(saved.user); // the server may change it, e.g. "kab 123" -> "KAB 123"
    showToast("Profile saved.", "success");
    return true;
  } catch (error) {
    // for example "This email is already registered."
    showToast(error.message, "error");
    return false;
  } finally {
    button.disabled = false;
  }
}

// profile.html calls this once when the page opens
function setupProfile() {
  document.getElementById("profile-form").addEventListener("submit", function (event) {
    event.preventDefault(); // stay on the page, we send the data ourselves
    saveProfile();
  });
  loadProfile();
}

// lets the Jest tests use the functions (the browser ignores this)
if (typeof module !== "undefined") {
  module.exports = { validateProfile, readProfileForm, fillProfileForm, showProfileErrors, loadProfile, saveProfile, setupProfile };
}
