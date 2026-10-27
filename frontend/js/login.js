/*
  login.js
  Summary: Runs when the Login button is clicked. It reads email and password,
  checks them with validateLogin() and shows validation errors. If the inputs
  are valid, it sends them to the login API. After a successful response, it
  saves the token and role in localStorage, then redirects drivers to
  dashboard.html and admins to admin.html. Failed requests show an error.
*/

// Find the form and its Login button.
var form = document.querySelector("form");
var submitButton = form.querySelector('button[type="submit"]');

// Track whether a login request is already running.
var loginPending = false;

// Clear old messages when the user changes an input.
form.addEventListener("input", clearMessage);

form.addEventListener("submit", async function (event) {
  event.preventDefault(); // Stop the page from reloading.

  // Prevent another request while the first is running.
  if (loginPending) {
    return;
  }

  clearMessage();

  // Remove outside spaces from the email.
  // Keep the password exactly as entered.
  var data = {
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value
  };

  // Check the values using validators.js and display field errors.
  var result = validateLogin(data);
  showErrors(result.errors);

  // Do not contact the server if the inputs are invalid.
  if (!result.valid) {
    return;
  }

  // Disable the button while waiting for the server.
  loginPending = true;
  submitButton.disabled = true;
  submitButton.textContent = "LOGGING IN...";

  try {
    // Send email and password using the helper in api.js.
    var response = await postToApi("/auth/login", data);

    // Require a non-empty token and one of the agreed roles.
    if (
      !response ||
      typeof response.token !== "string" ||
      response.token.trim() === "" ||
      (response.role !== "driver" && response.role !== "admin")
    ) {
      throw new Error(
        "The server returned invalid login details. Please try again."
      );
    }

    // Use the same keys as Stefania's navigation and logout code.
    localStorage.setItem("token", response.token);
    localStorage.setItem("role", response.role);

    // Open the correct page for the role returned by the API.
    if (response.role === "admin") {
      window.location.href = "admin.html";
    } else {
      window.location.href = "dashboard.html";
    }
  } catch (error) {
    // Clear any previous or partially saved login information.
    localStorage.removeItem("token");
    localStorage.removeItem("role");

    // Show the error message in red.
    showMessage(error.message, true);
  } finally {
    // Restore the button after the request finishes.
    loginPending = false;
    submitButton.disabled = false;
    submitButton.textContent = "LOGIN";
  }
});