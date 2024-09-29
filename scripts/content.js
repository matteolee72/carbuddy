const body = document.querySelector("section.body");
if (body) {
  fetch(chrome.runtime.getURL("components/index.html"))
    .then((r) => r.text())
    .then((html) => {
      const heading = body.querySelector("div.mapbox");
      heading.insertAdjacentHTML("beforebegin", html); // extension html inserted, can manipulate AFTER this line
      setZipCodeButton();
      svgLoadingAnimationHandler();
      addMontserratFontFace();
    });
}

function addMontserratFontFace() {
  const fontURL = chrome.runtime.getURL('assets/fonts/Montserrat-VariableFont_wght.ttf');
  const style = document.createElement('style');
  style.textContent = `
      @font-face {
          font-family: 'Montserrat';
          font-style: normal;
          font-weight: 400;
          src: url('${fontURL}');
      }
  `;
  document.head.appendChild(style);
}

function svgLoadingAnimationHandler() {
  const kbbPriceAdvisor = document.querySelector("#kbb-price-advisor");
  const container = document.querySelector(
    ".condition-and-kbb-price-advisor-container"
  );
  const loaderWrapper = container.querySelector(".loader-wrapper");
  function showLoader() {
    loaderWrapper.style.display = "flex";
  }
  function hideLoader() {
    loaderWrapper.style.display = "none";
  }

  // MutationObserver to watch for child additions to kbb-price-advisor
  const mutationCallback = function (mutationsList, observer) {
    for (let mutation of mutationsList) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        hideLoader();
      }
    }
  };

  const observer = new MutationObserver(mutationCallback);
  const config = { childList: true };
  observer.observe(kbbPriceAdvisor, config);

  // Listen for the transition end event
  container.addEventListener("transitionend", function (event) {
    if (
      event.propertyName === "height" &&
      container.classList.contains("expanded")
    ) {
      showLoader();
    }
  });
}

function setZipCodeButton() {
  const zipCodeInput = document.querySelector(".zip-code-input");
  const submitButton = document.querySelector(".save-button");

  chrome.storage.local.get("zipCode").then((result) => {
    const zipCode = result.zipCode ? result.zipCode : "";
    if (zipCode !== "") {
      zipCodeInput.placeholder = "Current ZIP Code: " + zipCode;
    }
  });

  submitButton.addEventListener("click", function () {
    const zipCode = zipCodeInput.value;

    // Validate that the input is a number and has a length of 5 (assuming US ZIP code)
    if (/^\d{5}$/.test(zipCode)) {
      chrome.storage.local
        .set({ zipCode: zipCode })
        .then(() => {
          submitButton.style.backgroundColor = "#ccc";
          submitButton.textContent = "Saved";
        })
        .catch((error) => {
          console.error("Error setting ZIP Code: ", error);
        });
    } else {
      console.error("Invalid ZIP Code");
    }
  });
}

const attrGroups = document.querySelectorAll(".attrgroup");

if (attrGroups.length > 0) {
  const allCarDetails = []; // Array to store data from all groups
  const price = document.querySelector(".price");
  allCarDetails.push({ price: price.textContent.trim() });

  attrGroups.forEach((attrGroup) => {
    const carDetails = {}; // Object to store data for each group
    const attributeElements = attrGroup.querySelectorAll(".attr");
    attributeElements.forEach((attr) => {
      if (attr.classList.contains("important")) {
        const yearSpan = attr.querySelector(".year");
        const makemodelSpan = attr.querySelector(".makemodel");
        const year = yearSpan.textContent.trim();
        const makemodel = makemodelSpan.textContent.trim();
        carDetails["year"] = year;
        carDetails["makemodel"] = makemodel;
      } else {
        const labelSpan = attr.querySelector(".labl");
        const valueSpan = attr.querySelector(".valu");
        if (labelSpan && valueSpan) {
          const label = labelSpan.textContent.trim().replace(/:$/, "");
          const value = valueSpan.textContent.trim();
          carDetails[label] = value;
        }
      }
    });
    allCarDetails.push(carDetails);
  });
  chrome.storage.local.set({ allCarDetails }, () => {
    chrome.runtime.sendMessage({ type: "carDetails", allCarDetails });
  });
} else {
}

function processCarYearMakeModelString(allCarDetails) {
  const year = allCarDetails[1].year;
  const makemodel = allCarDetails[1].makemodel.split(" ");
  for (let i = 0; i < makemodel.length; i++) {
    makemodel[i] = makemodel[i][0].toUpperCase() + makemodel[i].substr(1);
  }
  const makeModelString = makemodel.join(" ");
  return year + " " + makeModelString;
}

function processConditionString(condition) {
  const conditionAsList = condition.split(" ");
  for (let i = 0; i < conditionAsList.length; i++) {
    conditionAsList[i] =
      conditionAsList[i][0].toUpperCase() + conditionAsList[i].substr(1);
  }
  const conditionString = conditionAsList.join(" ");
  return conditionString;
}

// Listening for response from service worker, then populate data
let processedData = [];

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "processedData") {
    processedData = message.allCarDetails;
    updateWithProcessedData(processedData);
  }
  if (message.type === "svgContent") {
    svgContent = message.svgContent;
    document.querySelector("#kbb-price-advisor").innerHTML = svgContent;
    const bodyStylesContainer = document.querySelector(
      ".body-styles-container"
    );
    const conditionAdvisorContainer = document.querySelector(
      ".condition-and-kbb-price-advisor-container"
    );
    const conditionDropdownPresent = document.querySelector(".condition-title");
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, "image/svg+xml");

    if (!conditionDropdownPresent) {
      setTimeout(insertConditionDropdown(), 1000);
    }
    if (
      bodyStylesContainer &&
      !bodyStylesContainer.classList.contains("removed")
    ) {
      bodyStylesContainer.classList.add("removed");
    }
    if (!conditionAdvisorContainer?.classList.contains("expanded")) {
      conditionAdvisorContainer.classList.add("expanded");
    }

    const rangeBox = svgDoc.querySelector("#RangeBox");
    if (rangeBox) {
      // Once the range box is found, find the last text element within it
      const textElements = rangeBox.getElementsByTagName("text");
      const lastTextElement = textElements[textElements.length - 1];

      if (lastTextElement) {
        // Extract the text content from the last text element
        const privatePartyRangeString = lastTextElement.textContent.trim();
        const cleanedPrivatePartyRangeString = privatePartyRangeString.replace(
          /[$,]/g,
          ""
        );
        const cleanedPriceString = processedData[0].price.replace(/[$,]/g, "");
        const price = parseFloat(cleanedPriceString);
        const privatePartyRange = parseFloat(cleanedPrivatePartyRangeString);
        const difference = privatePartyRange - price;
        const percentageDifference = (
          (difference / privatePartyRange) *
          100
        ).toFixed(1);
        const differenceString = "$" + difference.toLocaleString();
        const percentageDifferenceString =
          percentageDifference.toLocaleString() + "%";
        const differenceElement = document.querySelector(".price-difference");
        const percentageElement = document.querySelector(
          ".percentage-difference"
        );
        const fairValueElement = document.querySelector(".fair-value");
        fairValueElement.textContent = privatePartyRangeString;
        differenceElement.textContent = differenceString;
        percentageElement.textContent = percentageDifferenceString;

        if (difference > 0) {
          differenceElement.style.color = "green";
          percentageElement.style.color = "green";
        } else {
          differenceElement.style.color = "red";
          percentageElement.style.color = "red";
        }
      } else {
      }
    } else {
    }
    updateWithProcessedData(processedData);
  }
  if (message.type === "bodyStyles") {
    bodyStyles = message.bodyStyles;
    insertBodyStylesList(bodyStyles);
  }
  if (message.type === "conditionDropdown") {
    insertConditionDropdown();
  }
  if (message.type === "setBodyStyle") {
    bodyStyle = message.bodyStyle;
  }
  if (message.type === "errorFetchingBodyStyles") {
    handleErrorFetchingBodyStyles();
  }
});

function insertConditionDropdown() {
  const conditionTitle = document.createElement("div");
  conditionTitle.setAttribute("class", "condition-title");
  conditionTitle.textContent = "Selected Condition";

  const select = document.createElement("select");
  select.setAttribute("class", "condition-select");

  const options = ["Fair", "Good", "Very Good", "Excellent"];

  options.forEach((option) => {
    const optionElement = document.createElement("option");
    optionElement.value = option;
    optionElement.textContent = option;
    if (option == "Good") {
      optionElement.selected = true;
    }
    select.appendChild(optionElement);
  });

  // Append the container to the document body or any other desired parent element
  const existingContainer = document.getElementById("condition-container");
  existingContainer.appendChild(conditionTitle);
  existingContainer.appendChild(select);

  // Add event listener to the select element
  select.addEventListener("change", function (event) {
    const condition = event.target.value;
    addSkeletonClass();
    const loaderWrapper = document.querySelector(".loader-wrapper");
    const currentSvg = document.querySelector("#PriceAdvisor");
    currentSvg.remove();
    loaderWrapper.style.display = "flex";
    chrome.runtime.sendMessage({
      type: "selectedCondition",
      condition,
      bodyStyle,
    });
  });
}

let bodyStyle = "";

function insertBodyStylesList(styles) {
  const existingContainer = document.querySelector(".body-styles-container");
  const extensionContainer = document.querySelector(
    ".condition-and-kbb-price-advisor-container"
  );

  const kbbContainer = document.createElement("div");
  kbbContainer.className = "body-styles-list-container";

  styles.forEach((style) => {
    const styleDiv = document.createElement("div");
    styleDiv.textContent = style;
    styleDiv.title = style;
    styleDiv.href = style;
    styleDiv.classList.add("cv-link");
    styleDiv.classList.add("body-styles-option");
    styleDiv.target = "_blank";
    styleDiv.onclick = () => {
      addSkeletonClass();
      extensionContainer.classList.add("expanded");
      bodyStyle = style;
      chrome.runtime.sendMessage({ type: "selectedBodyStyle", style });
      existingContainer.classList.add("removed");
    };
    let transitionCount = 0;
    existingContainer.addEventListener("transitionend", () => {
      transitionCount++;
      if (transitionCount == 2) {
        existingContainer.remove();
        transitionCount = 0;
      }
    });
    kbbContainer.appendChild(styleDiv);
  });

  const bodyStyleSelectTitle = document.createElement("h3");
  bodyStyleSelectTitle.className = "body-styles-select-title";
  bodyStyleSelectTitle.textContent = "Select Body Style";

  existingContainer.appendChild(bodyStyleSelectTitle);
  existingContainer.appendChild(kbbContainer);
}

function updateWithProcessedData(processedData) {
  removeSkeletonClass();
  const priceElement = document.querySelector(".listed-price");
  const conditionElement = document.querySelector(".listed-condition");
  priceElement.textContent = processedData[0].price;
  conditionElement.textContent = processedData[2].condition
    ? processConditionString(processedData[2].condition)
    : "-";

  const carYearMakeModel = document.querySelector(".car-year-make-model");
  const carYearMakeModelString = processCarYearMakeModelString(processedData);
  carYearMakeModel.textContent = carYearMakeModelString;
}

function removeSkeletonClass() {
  const listedPrice = document.querySelector(".listed-price");
  const fairValue = document.querySelector(".fair-value");
  const priceDifference = document.querySelector(".price-difference");
  const percentageDifference = document.querySelector(".percentage-difference");
  const listedCondition = document.querySelector(".listed-condition");

  listedPrice.classList.remove("skeleton");
  fairValue.classList.remove("skeleton");
  priceDifference.classList.remove("skeleton");
  percentageDifference.classList.remove("skeleton");
  listedCondition.classList.remove("skeleton");
}

function addSkeletonClass() {
  const listedPrice = document.querySelector(".listed-price");
  const fairValue = document.querySelector(".fair-value");
  const priceDifference = document.querySelector(".price-difference");
  const percentageDifference = document.querySelector(".percentage-difference");
  const listedCondition = document.querySelector(".listed-condition");

  listedPrice.textContent = "";
  fairValue.textContent = "";
  priceDifference.textContent = "";
  percentageDifference.textContent = "";
  listedCondition.textContent = "";

  listedPrice.classList.add("skeleton");
  fairValue.classList.add("skeleton");
  priceDifference.classList.add("skeleton");
  percentageDifference.classList.add("skeleton");
  listedCondition.classList.add("skeleton");
}

function handleErrorFetchingBodyStyles() {
  const bodyStylesContainer = document.querySelector(".body-styles-container");

  const noMatchTitle = document.createElement("h3");
  noMatchTitle.textContent = "Oops!";
  noMatchTitle.classList.add("no-match-title");
  const noMatchBody = document.createElement("h2");
  noMatchBody.textContent = "We couldn't find a match.";
  noMatchBody.classList.add("no-match-body");

  bodyStylesContainer.appendChild(noMatchTitle);
  bodyStylesContainer.appendChild(noMatchBody);

  const redirectKbb = document.createElement("div");
  redirectKbb.textContent = "Search on KBB";
  redirectKbb.classList.add("redirect-kbb");
  redirectKbb.href = "https://www.kbb.com/car-prices/";
  redirectKbb.onclick = () => {
    window.open("https://www.kbb.com/car-prices/", "_blank");
  };
  bodyStylesContainer.appendChild(redirectKbb);
}
