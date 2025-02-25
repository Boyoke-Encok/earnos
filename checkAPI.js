const axios = require("axios");
const { log } = require("./utils"); // Adjust the path as necessary
const settings = require("./config/config");

const urlChecking = "https://raw.githubusercontent.com/Boyoke-Encok/api-id/refs/heads/main/endpoint.json";

async function checkBaseUrl() {
  console.log("Checking api...".blue);
  if (settings.ADVANCED_ANTI_DETECTION) {
    const result = await getBaseApi(urlChecking);
    if (result.endpoint) {
      log("No change in api!", "success");
      return result;
    }
  } else {
    return {
      endpoint: settings.BASE_URL,
      message:
        "BY : BOYOKE ENCOK",
    };
  }
}

async function getBaseApi(url) {
  try {
    const response = await axios.get(url);
    const content = response.data;
    if (content?.xstar) {
      return { endpoint: content.xstar, message: content.copyright };
    } else {
      return {
        endpoint: null,
        message:
          "BY : BOYOKE ENCOK",
      };
    }
  } catch (e) {
    return {
      endpoint: null,
      message:
        "BY : BOYOKE ENCOK",
    };
  }
}

module.exports = { checkBaseUrl };
