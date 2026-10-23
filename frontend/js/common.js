/*
  common.js
  Shared helpers for both forms. These functions change what the user sees.
  Validation rules are kept separately in validators.js.
*/

// The HTML passes the input ID and the button that was clicked (this).
function showPassword(inputId, button) {
  var input = document.getElementById(inputId);
  if (input.type === "password") {
    input.type = "text";
    button.textContent = "Hide";
    button.setAttribute("aria-label", "Hide password");
  } else {
    input.type = "password";
    button.textContent = "Show";
    button.setAttribute("aria-label", "Show password");
  }
}

// Display each field error and move the keyboard focus to the first one.
function showErrors(errors) {
  var errorBoxes = document.querySelectorAll(".error");
  var firstInvalidInput = null;

  for (var i = 0; i < errorBoxes.length; i++) {
    // data-for in the HTML tells us which input this error belongs to.
    var field = errorBoxes[i].dataset.for;
    var input = document.getElementById(field);
    var error = errors[field] || "";
    errorBoxes[i].textContent = error;

    // Screen readers can also identify which inputs contain errors.
    if (error) {
      input.setAttribute("aria-invalid", "true");
      if (firstInvalidInput === null) {
        firstInvalidInput = input;
      }
    } else {
      input.removeAttribute("aria-invalid");
    }
  }

  if (firstInvalidInput !== null) {
    firstInvalidInput.focus();
  }
}

// Remove an old success message before checking changed information.
function clearMessage() {
  var message = document.getElementById("message");
  message.textContent = "";
  message.className = "message";
}

// A valid form is not yet a registered account or an authenticated login.
function showMessage(text) {
  var message = document.getElementById("message");
  message.textContent = text;
  message.className = "message success";
}
