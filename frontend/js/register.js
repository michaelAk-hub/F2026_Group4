/*
  register.js
  Summary: Runs when the Register button is clicked. It reads the five form
  values, checks them with validateRegister() and shows validation errors.
  If the inputs are valid, it sends the registration details to the API.
  A successful response shows a message asking the user to log in.
  Failed requests show an error.
*/

// Find the form and its Register button.
var form = document.querySelector("form");
var submitButton = form.querySelector('button[type="submit"]');

// Track whether a registration request is already running.
var registrationPending = false;

// Clear old messages when the user changes an input.
form.addEventListener("input", clearMessage);

form.addEventListener("submit", async function (event) {
  event.preventDefault(); // Stop the page from reloading.

  // Prevent another request while the first is running.
  if (registrationPending) {
    return;
  }

  clearMessage();

  // Remove outside spaces from ordinary text fields.
  // Keep passwords exactly as entered.
  var data = {
    name: document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value,
    confirmPassword: document.getElementById("confirmPassword").value,
    carNumber: document.getElementById("carNumber").value.trim()
  };

  // Check the values using validators.js and display field errors.
  var result = validateRegister(data);
  showErrors(result.errors);

  // Do not contact the server if the inputs are invalid.
  if (!result.valid) {
    return;
  }

  // Only send the account details, not the confirmation field.
  // Confirm these field names with Giorgos before integration.
  var accountData = {
    name: data.name,
    email: data.email,
    password: data.password,
    carNumber: data.carNumber
  };

  // Disable the button while waiting for the server.
  registrationPending = true;
  submitButton.disabled = true;
  submitButton.textContent = "REGISTERING...";

  try {
    // Send the details using the helper in api.js.
    await postToApi("/auth/register", accountData);

    // Clear the form only after the API reports success.
    form.reset();

    // Return password fields to their hidden state.
    document.getElementById("password").type = "password";
    document.getElementById("confirmPassword").type = "password";

    var passwordButtons = form.querySelectorAll(".eye");

    for (var i = 0; i < passwordButtons.length; i++) {
      passwordButtons[i].textContent = "Show";
      passwordButtons[i].setAttribute("aria-label", "Show password");
    }

    // The user can use the existing Login here link below the form.
    showMessage("Account created successfully. Please log in.");
  } catch (error) {
    // Keep the entered values so the user can correct or retry them.
    showMessage(error.message, true);
  } finally {
    // Restore the button after the request finishes.
    registrationPending = false;
    submitButton.disabled = false;
    submitButton.textContent = "REGISTER";
  }
});