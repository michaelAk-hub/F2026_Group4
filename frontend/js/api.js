/*
  api.js — Maria Antoniou
  Sends JSON data to the Smart Parking backend.
  Login and registration use postToApi(path, data).
  Reservations also pass the logged-in driver's token.
*/

var API_BASE_URL = "http://localhost:3000/api";

async function postToApi(path, data, token) {
  var headers = {
    "Content-Type": "application/json"
  };

  // Protected routes use this token to identify the logged-in driver.
  if (token) {
    headers.Authorization = "Bearer " + token;
  }

  var response;

  try {
    response = await fetch(API_BASE_URL + path, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(data)
    });
  } catch (error) {
    throw new Error("Cannot connect to the server. Please try again later.");
  }

  var result;

  try {
    result = await response.json();
  } catch (error) {
    throw new Error("The server returned an unexpected response. Please try again.");
  }

  // Show the backend's explanation, for example when a spot is already booked.
  if (!response.ok) {
    var message = "The request failed. Please try again.";

    if (result && typeof result.message === "string") {
      message = result.message;
    }

    throw new Error(message);
  }

  return result;
}