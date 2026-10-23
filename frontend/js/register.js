/*
  register.js
  Summary: Runs when the Register button is clicked. It reads the five form values,
  checks them with validateRegister() and shows the errors. If everything is valid it
  shows a message (in Week 2 it will send the data to the server instead).
*/
// Find the form on the page
var form = document.querySelector("form");

// A message about old values should disappear as soon as the user edits them.
form.addEventListener("input", clearMessage);

form.addEventListener("submit", function (event) {
  event.preventDefault(); // stop the page from reloading
  clearMessage(); // do not leave an old green message beside new errors

  // Read the inputs. Remove outside spaces from ordinary text fields.
  // Keep passwords exactly as entered; do not trim or change them.
  var data = {
    name: document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value,
    confirmPassword: document.getElementById("confirmPassword").value,
    carNumber: document.getElementById("carNumber").value.trim()
  };

  // Check the values with the rules from validators.js, then show or clear errors
  var result = validateRegister(data);
  showErrors(result.errors);

  if (result.valid) {
    // Week 2: send the data to the server here
    showMessage("Form checks passed. This prototype does not create an account yet.");
  }
});
