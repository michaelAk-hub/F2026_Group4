/**
 * @jest-environment jsdom
 */
// Tests for the profile page - Stefania (Week 5)
// The page is loaded from profile.html. The scripts do not run here, so the
// functions of the other files are given to the page by hand:
// requestApi (api.js) is replaced with a fake server, the checks come from
// Maria's validators.js and showToast from toast.js.

const fs = require("fs");
const path = require("path");
const validators = require("../js/validators");
const toast = require("../js/toast");
const profile = require("../js/profile");

const savedProfile = {
  id: "u1",
  name: "Maria Pappa",
  email: "maria@test.com",
  carNumber: "KAB 123",
  paymentMethod: "Visa ending 4242"
};

const goodData = {
  name: "Maria Pappa",
  email: "maria@test.com",
  carNumber: "KAB 123",
  paymentMethod: "Visa ending 4242"
};

// copy the good data and change one field
function dataWith(field, value) {
  const data = Object.assign({}, goodData);
  data[field] = value;
  return data;
}

function errorOf(field) {
  return document.querySelector('#profile-form .error[data-for="' + field + '"]').textContent;
}

function toastTexts() {
  const toasts = document.querySelectorAll("#toast-area .toast span");
  const texts = [];
  for (let i = 0; i < toasts.length; i++) {
    texts.push(toasts[i].textContent);
  }
  return texts;
}

beforeEach(() => {
  const html = fs.readFileSync(path.join(__dirname, "..", "profile.html"), "utf8");
  document.documentElement.innerHTML = html;
  localStorage.setItem("token", "test-token");

  global.isValidEmail = validators.isValidEmail;
  global.isValidCarNumber = validators.isValidCarNumber;
  global.showToast = toast.showToast;

  // the fake server: GET gives the profile, PUT gives back what was sent
  global.requestApi = jest.fn(async (method, url, data) => {
    if (method === "GET") {
      return { user: savedProfile };
    }
    return { message: "Profile updated.", user: Object.assign({}, data, { carNumber: data.carNumber.toUpperCase() }) };
  });
});

afterEach(() => {
  delete global.requestApi;
  localStorage.clear();
});

describe("profile form validation (RQ12)", () => {
  test("correct details have no errors", () => {
    const result = profile.validateProfile(goodData);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  test("the name needs at least 2 characters", () => {
    expect(profile.validateProfile(dataWith("name", "M")).errors.name).toBeDefined();
  });

  test("the email must be a real email address", () => {
    expect(profile.validateProfile(dataWith("email", "maria.test.com")).errors.email).toBeDefined();
  });

  test("the car number must be 3 letters and 3 numbers", () => {
    expect(profile.validateProfile(dataWith("carNumber", "KA 12")).errors.carNumber).toBeDefined();
    expect(profile.validateProfile(dataWith("carNumber", "kab123")).valid).toBe(true);
  });
});

describe("payment details (RQ13, PCI-DSS)", () => {
  test("the payment method is optional", () => {
    expect(profile.validateProfile(dataWith("paymentMethod", "")).valid).toBe(true);
  });

  test("a card number is not accepted, even with spaces or dashes", () => {
    expect(profile.validateProfile(dataWith("paymentMethod", "4242 4242 4242 4242")).errors.paymentMethod).toContain("card number");
    expect(profile.validateProfile(dataWith("paymentMethod", "Visa 42424-242")).errors.paymentMethod).toBeDefined();
  });

  test("the payment method can have at most 40 characters", () => {
    const long = "My blue Visa card from the bank of Cyprus, the old one";
    expect(profile.validateProfile(dataWith("paymentMethod", long)).errors.paymentMethod).toContain("40");
  });
});

describe("loading the profile", () => {
  test("GET /me with the token fills the form", async () => {
    await profile.loadProfile();
    expect(global.requestApi).toHaveBeenCalledWith("GET", "/me", undefined, "test-token");
    expect(document.getElementById("name").value).toBe("Maria Pappa");
    expect(document.getElementById("email").value).toBe("maria@test.com");
    expect(document.getElementById("carNumber").value).toBe("KAB 123");
    expect(document.getElementById("paymentMethod").value).toBe("Visa ending 4242");
  });

  test("if the server fails, a red toast shows its message", async () => {
    global.requestApi = jest.fn(async () => {
      throw new Error("Cannot connect to the server. Please try again later.");
    });
    const loaded = await profile.loadProfile();
    expect(loaded).toBe(false);
    expect(toastTexts()).toEqual(["Cannot connect to the server. Please try again later."]);
    expect(document.querySelector("#toast-area .toast").classList.contains("error")).toBe(true);
  });
});

describe("saving the profile", () => {
  test("wrong details show the errors and are not sent", async () => {
    profile.fillProfileForm(dataWith("carNumber", "12"));
    const saved = await profile.saveProfile();
    expect(saved).toBe(false);
    expect(errorOf("carNumber")).not.toBe("");
    expect(errorOf("name")).toBe("");
    expect(global.requestApi).not.toHaveBeenCalled();
    expect(toastTexts()).toEqual(["Please fix the highlighted fields."]);
  });

  test("good details are sent with PUT /me and a green toast says Profile saved", async () => {
    profile.fillProfileForm(dataWith("carNumber", "kab 999"));
    const saved = await profile.saveProfile();
    expect(saved).toBe(true);

    const call = global.requestApi.mock.calls[0];
    expect(call[0]).toBe("PUT");
    expect(call[1]).toBe("/me");
    expect(call[2].carNumber).toBe("kab 999");
    expect(call[3]).toBe("test-token");

    // the form shows what the server saved
    expect(document.getElementById("carNumber").value).toBe("KAB 999");
    expect(toastTexts()).toEqual(["Profile saved."]);
    expect(document.getElementById("save-profile").disabled).toBe(false);
  });

  test("an empty payment method is sent as null, so the server removes it", async () => {
    profile.fillProfileForm(dataWith("paymentMethod", "  "));
    await profile.saveProfile();
    expect(global.requestApi.mock.calls[0][2].paymentMethod).toBeNull();
  });

  test("an error from the server is shown in a red toast", async () => {
    global.requestApi = jest.fn(async () => {
      throw new Error("This email is already registered.");
    });
    profile.fillProfileForm(goodData);
    const saved = await profile.saveProfile();
    expect(saved).toBe(false);
    expect(toastTexts()).toEqual(["This email is already registered."]);
  });

  test("clicking SAVE CHANGES submits the form without leaving the page", async () => {
    profile.setupProfile();
    await Promise.resolve();
    const submit = new Event("submit", { cancelable: true });
    document.getElementById("profile-form").dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);
  });
});

test("profile page loads the scripts it needs and calls setupProfile()", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "profile.html"), "utf8");
  const order = ["js/auth.js", "js/api.js", "js/validators.js", "js/toast.js", "js/profile.js"];
  for (let i = 1; i < order.length; i++) {
    expect(html.indexOf('src="' + order[i] + '"')).toBeGreaterThan(html.indexOf('src="' + order[i - 1] + '"'));
  }
  expect(html).toContain("setupProfile()");
});
