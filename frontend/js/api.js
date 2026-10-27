/*
  api.js — Maria Antoniou (Week 2)
  Sends JSON data to the backend.
  Both login.js and register.js will use this helper.
*/

// Must match PORT in the backend's local .env file.
var API_BASE_URL = "http://localhost:3000/api";

async function postToApi(path, data) {
  var response;

  // Send the request. A stopped server or connection problem
  // will cause fetch() to throw an error.
  try {
    response = await fetch(API_BASE_URL + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });
  } catch (error) {
    throw new Error(
      "Cannot connect to the server. Please try again later."
    );
  }

  // Read the server's JSON response.
  var result;

  try {
    result = await response.json();
  } catch (error) {
    throw new Error(
      "The server returned an unexpected response. Please try again."
    );
  }

  // fetch() also returns responses for errors such as 400 or 401.
  // Check response.ok before treating the request as successful.
  if (!response.ok) {
    var message = "The request failed. Please try again.";

    if (result && typeof result.message === "string") {
      message = result.message;
    }

    throw new Error(message);
  }

  return result;
}