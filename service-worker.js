import { getMakeModel } from "./utils/make-model-handler.js";

const OFFSCREEN_DOCUMENT_PATH = "components/offscreen.html";

chrome.runtime.onMessage.addListener(handleMessages);

let allCarDetails = [];
let carDetailsCount = 0;

async function sendKbbHtmlToOffscreenDocument(type, data) {
  // Create an offscreen document if one doesn't exist yet
  if (!(await hasDocument())) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: [chrome.offscreen.Reason.DOM_PARSER],
      justification: "Parse DOM for SVG",
    });
  }

  chrome.runtime.sendMessage({
    type,
    target: "offscreen",
    data,
  });
}

// basic filtering and error checking on messages before dispatching the message to specific message handler.
async function handleMessages(message) {
  switch (message.type) {
    case "svg-object-url-result":
      handleSvgObjectUrlResult(message.data);
      closeOffscreenDocument();
      break;
    case "body-styles-result":
      handleBodyStylesResult(message.data);
      break;
    case "selectedBodyStyle":
      const kbbHtmlFinal = await fetchHtmlDataFromKbbBodyStyleSelected(
        message.style
      );
      await sendKbbHtmlToOffscreenDocument(
        "retrieve-svg-object-url",
        kbbHtmlFinal
      );
      break;
    case "selectedCondition":
      const kbbHtmlConditionSelected =
        await fetchHtmlDataFromKbbConditionSelected(
          message.condition,
          message.bodyStyle
        );
      await sendKbbHtmlToOffscreenDocument(
        "retrieve-svg-object-url",
        kbbHtmlConditionSelected
      );
      break;
    case "carDetails":
      // chrome.storage.local.get('allCarDetails', async (data) => {
      // allCarDetails = data.allCarDetails || []; // Handle potential absence of data
      allCarDetails = message.allCarDetails || [];
      carDetailsCount = carDetailsCount + 1;
      parameters.mileage = allCarDetails[2].odometer;
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "processedData",
          allCarDetails,
        });
      });
      const kbbHtml = await fetchHtmlDataFromKbbStyles(allCarDetails);
      // if kbbHtml = select body style, handleSelectBodyStyle
      // else send to offscreen document
      await sendKbbHtmlToOffscreenDocument("retrieve-svg-object-url", kbbHtml);
    default:
      console.warn(`Unexpected message type received: '${message.type}'.`);
  }
}

async function fetchHtmlDataFromKbbStyles(allCarDetails) {
  try {
    const url = "https://www.kbb.com/";
    const makeModel = getMakeModel(allCarDetails);
    const year = allCarDetails[1].year;

    const baseUrl = url.concat(makeModel, "/", year, "/", "styles/");
    const searchParams = new URLSearchParams(parameters);
    const fullUrl = `${baseUrl}?${searchParams.toString()}`;
    const response = await fetch(fullUrl, {
      headers: {
        "Cache-Control": "no-cache",
      },
    });
    const kbbHtml = await response.text(); // Get the HTML content as text

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    if (response.redirected) {
      handleOptionsNotRequired(response);
    }
    if (!response.redirected) {
      handleSelectBodyStyle(kbbHtml);
    }
    return kbbHtml;
  } catch (error) {
    console.error("Error fetching body styles data:", error);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { type: "errorFetchingBodyStyles" });
    });
    return null;
  }
}

async function fetchHtmlDataFromKbbBodyStyleSelected(style) {
  try {
    const url = "https://www.kbb.com/";
    const makeModel = getMakeModel(allCarDetails);
    const year = allCarDetails[1].year;

    const baseUrl = url.concat(
      makeModel,
      "/",
      year,
      "/",
      style.replace(/\s+/g, "-"),
      "/"
    );
    let searchParams = new URLSearchParams(parameters);
    const res = await chrome.storage.local.get("zipCode");
    const zipCode = res.zipCode ? res.zipCode : "";
    if (zipCode !== "") {
      searchParams.set("zipcode", zipCode);
    }
    const fullUrl = `${baseUrl}?${searchParams.toString()}`;
    const response = await fetch(fullUrl);
    const kbbHtml = await response.text();

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    // if (response.redirected) {
    //   handleOptionsNotRequired(response);
    // }
    // if (!response.redirected) {
    //   handleSelectBodyStyle(kbbHtml);
    // }
    return kbbHtml;
  } catch (error) {
    console.error("Error fetching data:", error);
    return null;
  }
}

async function fetchHtmlDataFromKbbConditionSelected(condition, style) {
  try {
    const conditionString = condition.toLowerCase().replace(/\s+/g, "-");
    const url = "https://www.kbb.com/";
    const makeModel = getMakeModel(allCarDetails);
    const year = allCarDetails[1].year;

    const baseUrl = url.concat(
      makeModel,
      "/",
      year,
      "/",
      style.replace(/\s+/g, "-"),
      "/"
    );
    let searchParams = new URLSearchParams(parameters);
    searchParams.set("condition", conditionString);
    const res = await chrome.storage.local.get("zipCode");
    const zipCode = res.zipCode ? res.zipCode : "";
    if (zipCode !== "") {
      searchParams.set("zipcode", zipCode);
    }
    const fullUrl = `${baseUrl}?${searchParams.toString()}`;
    const response = await fetch(fullUrl);
    const kbbHtml = await response.text();

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    return kbbHtml;
  } catch (error) {
    console.error("Error fetching data:", error);
    return null;
  }
}

async function handleSelectBodyStyle(document) {
  await sendKbbHtmlToOffscreenDocument("retrieve-body-styles", document);
}

async function handleOptionsNotRequired(response) {
  // Get the final URL from the response headers
  const finalURL = response.url;
  if (finalURL == "https://www.kbb.com/car-prices/") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { type: "errorFetchingBodyStyles" });
    });
    return;
  }
  const modifiedURL = transformURLFirstCase(finalURL);
  const kbbHtmlFinal = await fetchHtmlDataFromKbbDirect(modifiedURL);

  const bodyStyle = extractBodyStyle(modifiedURL);
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { type: "setBodyStyle", bodyStyle });
  });

  await sendKbbHtmlToOffscreenDocument("retrieve-svg-object-url", kbbHtmlFinal);
}

const parameters = {
  condition: "good",
  intent: "buy-used",
  mileage: "null",
  pricetype: "private-party",
};

async function handleBodyStylesResult(bodyStyles) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { type: "bodyStyles", bodyStyles });
  });
}

async function handleSvgObjectUrlResult(svgUrl) {
  fetch(svgUrl)
    .then((response) => response.text())
    .then((svgContent) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { type: "svgContent", svgContent });
      });
    })
    .catch((error) => {
      console.error("Error fetching SVG:", error);
    });
}

async function closeOffscreenDocument() {
  if (!(await hasDocument())) {
    return;
  }
  await chrome.offscreen.closeDocument();
}

async function hasDocument() {
  // Check all windows controlled by the service worker if one of them is the offscreen document
  const matchedClients = await clients.matchAll();
  for (const client of matchedClients) {
    if (client.url.endsWith(OFFSCREEN_DOCUMENT_PATH)) {
      return true;
    }
  }
  return false;
}

fetch(
  "https://www.kbb.com/bmw/4-series/2018/styles/?intent=buy-used&mileage=180000"
)
  .then((response) => {
    // Check if response is a redirect
    if (response.redirected) {
      // Get the final URL from the response headers
      const finalURL = response.url;
    } else {
    }
  })
  .catch((error) => {
    console.error("Error:", error);
  });

// 3rd case, body style select, no redirect
fetch(
  "https://www.kbb.com/toyota/camry/2010/styles/?intent=buy-used&mileage=180000"
)
  .then((response) => {
    // Check if response is a redirect
    if (response.redirected) {
      // Get the final URL from the response headers
      const finalURL = response.url;
    } else {
    }
  })
  .catch((error) => {
    console.error("Error:", error);
  });

/*
always styles/ first, then change behaviour based on response.
1. straight to kbb value
2. straight to select body style
3. category response
4. all other error handling * figure out how (build this after the first so we know that it can catch 2 and 3 when 1 fails)

styles/?
options/? (the only diff is that this is done, why is this done?)
model/?
*/

// TODO: low prio failsafe > stop creating extra dropdowns regardless of whether 'select body style' buttons are clicked (detect if dropdown created already)

function transformURLFirstCase(inputURL) {
  // Parse the input URL
  let url = new URL(inputURL);

  // Extract the existing search parameters
  let params = new URLSearchParams(url.search);

  // Create a new URLSearchParams object for the new URL
  let newParams = new URLSearchParams();

  // Add necessary values to the newParams object
  if (params.has("category")) newParams.set("category", params.get("category"));
  newParams.set("condition", "good");
  if (params.has("intent")) newParams.set("intent", params.get("intent"));
  if (params.has("mileage")) newParams.set("mileage", params.get("mileage"));
  newParams.set("pricetype", "private-party");

  // Construct the new URL without the 'options/' segment
  let newUrlPath = url.pathname.replace("/options", "");
  let newUrl = `${url.origin}${newUrlPath}?${newParams.toString()}`;

  // Return the modified URL
  return newUrl;
}

async function fetchHtmlDataFromKbbDirect(url) {
  try {
    const res = await chrome.storage.local.get("zipCode");
    const zipCode = res.zipCode ? res.zipCode : "";
    if (zipCode !== "") {
      const zipCodeParam = "&zipcode=" + zipCode;
      url += zipCodeParam;
    }
    const fullUrl = url;
    const response = await fetch(fullUrl);
    const kbbHtml = await response.text();
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    return kbbHtml;
  } catch (error) {
    console.error("Error fetching data:", error);
    return null;
  }
}

function extractBodyStyle(url) {
  try {
    // Create a new URL object from the given URL string
    const urlObj = new URL(url);

    // Get the pathname part of the URL, which contains the body style
    const pathname = urlObj.pathname;

    // Split the pathname into segments
    const segments = pathname.split("/");

    // The body style is the last non-empty segment
    const bodyStyle = segments.filter((segment) => segment !== "").pop();

    return bodyStyle;
  } catch (error) {
    console.error("Invalid URL:", error);
    return null;
  }
}
