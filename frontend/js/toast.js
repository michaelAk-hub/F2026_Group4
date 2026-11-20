// Toasts - Stefania (Week 5)
// A toast is a small message in the corner of the page, for example "Profile saved."
// It hides by itself after a few seconds, or when the user clicks the x.

var TOAST_TIME = 3000; // 3 seconds

// type is "success" (green) or "error" (red)
function showToast(text, type) {
  var area = document.getElementById("toast-area");

  // a page without the area still gets the toast
  if (!area) {
    area = document.createElement("div");
    area.id = "toast-area";
    area.className = "toast-area";
    document.body.appendChild(area);
  }

  var toast = document.createElement("div");
  toast.className = "toast " + type;
  toast.setAttribute("role", type === "error" ? "alert" : "status");

  var message = document.createElement("span");
  message.textContent = text;
  toast.appendChild(message);

  var close = document.createElement("button");
  close.type = "button";
  close.className = "toast-close";
  close.setAttribute("aria-label", "Close message");
  close.textContent = "×";
  close.addEventListener("click", function () {
    hideToast(toast);
  });
  toast.appendChild(close);

  area.appendChild(toast);

  // hide it by itself after TOAST_TIME
  setTimeout(function () {
    hideToast(toast);
  }, TOAST_TIME);

  return toast;
}

function hideToast(toast) {
  // it may already be closed by the x button
  if (toast.parentNode) {
    toast.parentNode.removeChild(toast);
  }
}

// lets the Jest tests use the functions (the browser ignores this)
if (typeof module !== "undefined") {
  module.exports = { TOAST_TIME, showToast, hideToast };
}
