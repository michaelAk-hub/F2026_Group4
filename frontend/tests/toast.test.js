/**
 * @jest-environment jsdom
 */
// Tests for the toasts - Stefania (Week 5)
// Fake timers let the test move the clock forward instead of waiting 3 seconds.

const toast = require("../js/toast");

beforeEach(() => {
  document.body.innerHTML = '<div class="toast-area" id="toast-area"></div>';
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

function toastsOnPage() {
  return document.querySelectorAll("#toast-area .toast");
}

describe("toasts", () => {
  test("a toast shows the message", () => {
    toast.showToast("Profile saved.", "success");
    expect(toastsOnPage().length).toBe(1);
    expect(toastsOnPage()[0].querySelector("span").textContent).toBe("Profile saved.");
  });

  test("a success toast is green and an error toast is red", () => {
    toast.showToast("Profile saved.", "success");
    toast.showToast("This email is already registered.", "error");
    expect(toastsOnPage()[0].classList.contains("success")).toBe(true);
    expect(toastsOnPage()[1].classList.contains("error")).toBe(true);
  });

  test("an error toast is read out by screen readers at once", () => {
    toast.showToast("Error", "error");
    expect(toastsOnPage()[0].getAttribute("role")).toBe("alert");
  });

  test("the toast hides by itself after 3 seconds", () => {
    toast.showToast("Profile saved.", "success");
    jest.advanceTimersByTime(toast.TOAST_TIME - 1);
    expect(toastsOnPage().length).toBe(1);
    jest.advanceTimersByTime(1);
    expect(toastsOnPage().length).toBe(0);
  });

  test("the x button closes the toast at once", () => {
    toast.showToast("Profile saved.", "success");
    toastsOnPage()[0].querySelector(".toast-close").click();
    expect(toastsOnPage().length).toBe(0);
    // the timer later does not break anything
    jest.advanceTimersByTime(toast.TOAST_TIME);
    expect(toastsOnPage().length).toBe(0);
  });

  test("a page without the toast area still shows the toast", () => {
    document.body.innerHTML = "";
    toast.showToast("Profile saved.", "success");
    expect(document.querySelectorAll(".toast").length).toBe(1);
  });
});
