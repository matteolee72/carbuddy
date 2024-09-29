async function getCarDetails() {
  try {
    const carDetails = await chrome.storage.local.get("allCarDetails");
    const allCarDetails = carDetails.allCarDetails || [];
    console.log("Car details retrieved:", allCarDetails);
    return allCarDetails;
  } catch (error) {
    console.error("Error retrieving car details:", error);
    return null;
  }
}

function generateCarIssuePrompt(price, yearMakeModel, odometer) {
  if (!yearMakeModel) {
    console.error("Missing data in the provided car details.");
    return "Error: Insufficient data to generate the prompt.";
  }

  return `
      What are the most common issues that a ${yearMakeModel} specifically is known to have at ${odometer} miles? 
      Be selective, listing only issues that this car is known for and not common issues that every car will face. 
      Please classify them into Engine-Related Issues, Electrical Issues, Other Issues. 
  
      Beside each issue, please indicate how frequent they are for this car at ${odometer} mileage with a range of Very, Moderate, Low. 
      Please also indicate how severe each issue is with Extreme, Moderate, Low. An extremely severe issue is one where the repair will 
      have a significant cost relative to the price paid for the car (${price}) for the repair, is dangerous and potentially life-threatening, 
      or can cause the car to get totaled. A low severity issue is one where the cost of repair is low, it will not affect the safety of 
      the car and is limited to quality of life, or is not likely to get the car totaled. Please include a rough price range in the format 
      of $low - $high for each repair, from lowest at a good value mechanic to highest at the dealership in the East Bay area. 
      Please also include the mileage that the car typically experiences the issue as x-y miles. 
  
      No need to number the issues, no need to give notes or disclaimers. Label each category with ** and each issue with *.
      
      Always format each issue in one line with the following categories in this exact format as such:
      Name: (Name), Frequency: (High/Moderate/Low), Severity: (Extreme/Moderate/Low), 
      Repair Cost: $(low) - $(high), Mileage: (x-y) miles, Description: (Description Text).
    `;
}

async function fetchCarIssues(prompt) {
  try {
    const response = await fetch("https://carbuddy-oldzui4qxa-uw.a.run.app", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log(data);
    return data;
  } catch (error) {
    console.error("Error fetching car issues:", error);
    return null;
  }
}

function parseCarIssues(responseData) {
  try {
    const contentText = responseData.geminiData;
    return contentText;
  } catch (error) {
    console.error("Error parsing car issues:", error);
    return null;
  }
}

function extractIssueDetails(text) {
  const lines = text.split("\n"); // Split text into lines
  const issues = [];
  const issueRegex_1 = /.?\s\*\*\s/;
  const issueRegex_2 = /.?\*\s/;
  const issueRegex_3 = /.?\-\s/;

  let currentCategory = lines[0];
  console.log(currentCategory);
  currentCategory = currentCategory.replace(/^\*\*|\*\*$/g, "").trim();
  console.log(currentCategory);

  lines.forEach((line) => {
    line = line.trim();
    if (
      issueRegex_1.test(line) |
      issueRegex_2.test(line) |
      issueRegex_3.test(line)
    ) {
      // Start of a new issue
      let issueName = line
        .split(":")[0]
        .replace("* **", "")
        .replace("**", "")
        .trim();
      if (line.toLowerCase().includes("name:")) {
        // Extract the part after "Name:"
        const nameStart = line.indexOf("Name:") + "Name:".length;
        let nameEnd = line.indexOf(",", nameStart);
        issueName = line.substring(nameStart, nameEnd).trim();
      }
      const issueDetails = {};
      issueName = issueName
        .replace(/^[^a-zA-Z0-9]+/, "")
        .replace(/[^a-zA-Z0-9]+$/, "");
      issueDetails["Issue"] = issueName;

      let frequencyStart = line.indexOf("Frequency:") + "Frequency:".length;
      if (frequencyStart > "Frequency:".length - 1) {
        let frequencyEnd = line.indexOf(",", frequencyStart);
        issueDetails["Frequency"] = line
          .substring(frequencyStart, frequencyEnd)
          .trim();
      }

      let severityStart = line.indexOf("Severity:") + "Severity:".length;
      if (severityStart > "Severity:".length - 1) {
        let severityEnd = line.indexOf(",", severityStart);
        issueDetails["Severity"] = line
          .substring(severityStart, severityEnd)
          .trim();
      }

      let repairCostStart = line.indexOf("Repair Cost:");
      if (repairCostStart !== -1) {
        repairCostStart = repairCostStart + "Repair Cost:".length;
        let repairCostEnd = line.indexOf("Mileage:", repairCostStart);
        issueDetails["RepairCost"] = line
          .substring(repairCostStart, repairCostEnd)
          .replace(/[,\.\s]+$/, "")
          .trim();
      }

      let mileageStart = line.indexOf("Mileage:");
      let mileageEnd = line.indexOf("miles", mileageStart);
      if (mileageStart !== -1) {
        mileageStart = mileageStart + "Mileage:".length;
        issueDetails["Mileage"] = line
          .substring(mileageStart, mileageEnd)
          .trim();
      }

      let descriptionStart = mileageEnd + "miles".length;
      if (descriptionStart > -1) {
        issueDetails["Description"] = line
          .substring(descriptionStart + 1)
          .replace(/^[^a-zA-Z]+/, "")
          .trim();
      }

      issueDetails["Category"] = currentCategory;

      issues.push(issueDetails);
    }
    if (line.trim().startsWith("**")) {
      currentCategory = line
        .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "")
        .trim();
    }
  });
  return issues;
}

function parseIssues(text) {
  const issueCategories = text.split("\n\n**").slice(); // Split text into sections by category
  console.log(issueCategories);
  const issues = [];

  issueCategories.forEach((categorySection) => {
    const [categoryTitle, ...issueLines] = categorySection.split("\n");
    const category = categoryTitle
      .replace(/^[^A-Za-z]+/, "")
      .replace("**", "")
      .trim(); // Clean up the category title
    console.log(category);

    issueLines.forEach((issueLine) => {
      const issueMatch = issueLine.match(
        /\*\*(.+?):\*\* Frequency: (.+?), Severity: (.+?), Repair Cost: (.+?), Mileage: (.+?), Description: (.+)/
      );

      if (issueMatch) {
        const [_, name, frequency, severity, cost, mileage, description] =
          issueMatch;
        issues.push({
          name: name.trim(),
          category: category,
          frequency: frequency.trim(),
          severity: severity.trim(),
          cost: cost.trim(),
          mileage: mileage.trim(),
          description: description.trim(),
        });
      }
    });
  });

  return issues;
}

const responseText = `
**Engine-Related Issues**

* **Oil consumption:** Frequency: Moderate, Severity: Moderate, Repair Cost: $200 - $1,200, Mileage: 80,000 - 150,000 miles, Description: Excessive oil consumption due to engine wear.
* **Head gasket failure:** Frequency: Low, Severity: Extreme, Repair Cost: $2,500 - $5,000, Mileage: 100,000 - 200,000 miles, Description: Failure of the gasket between the cylinder head and engine block, causing coolant and oil leaks.
* **Water pump failure:** Frequency: Moderate, Severity: Moderate, Repair Cost: $500 - $1,000, Mileage: 60,000 - 120,000 miles, Description: Failure of the water pump, leading to overheating.

**Electrical Issues**

* **Inverter failure:** Frequency: Low, Severity: Extreme, Repair Cost: $3,000 - $5,000, Mileage: 120,000 - 200,000 miles, Description: Failure of the inverter, which converts DC power from the battery to AC power for the electric motor.
* **Battery pack degradation:** Frequency: Low, Severity: Moderate, Repair Cost: $1,500 - $3,000 (battery replacement), Mileage: 100,000 - 150,000 miles, Description: Loss of capacity in the battery pack, reducing the range and performance of the hybrid system.
* **Electrical system malfunctions:** Frequency: Moderate, Severity: Low, Repair Cost: $100 - $500, Mileage: Varies, Description: Various minor electrical issues, such as faulty sensors, lights, or switches.

**Other Issues**

* **Brake pedal pulsation:** Frequency: Moderate, Severity: Low, Repair Cost: $150 - $300, Mileage: 60,000 - 120,000 miles, Description: Vibration felt in the brake pedal due to warped brake rotors.
* **Suspension wear:** Frequency: Moderate, Severity: Low, Repair Cost: $500 - $1,200, Mileage: 80,000 - 140,000 miles, Description: Wear and tear on suspension components such as struts, shocks, and bushings.
* **Interior rattles:** Frequency: Moderate, Severity: Low, Repair Cost: $100 - $300, Mileage: Varies, Description: Noises and vibrations caused by loose interior components or trim pieces.
`;

const responseText2 = `
**Engine-Related Issues**

* **Oil Burning:** Frequency: Very, Severity: Moderate, Repair Cost: $250 - $600, Mileage: Constant
  * Prius engines are known to consume oil, especially as they age. This can lead to decreased engine performance and reduced fuel efficiency.
* **Inverter Failure:** Frequency: Low, Severity: Extreme, Repair Cost: $3,000 - $5,000, Mileage: 100,000 - 150,000 miles
  * The inverter is a key component in the hybrid system that converts DC power to AC power. A failure can render the car inoperable.

**Electrical Issues**

* **12-Volt Battery Failure:** Frequency: Moderate, Severity: Low, Repair Cost: $100 - $200, Mileage: 3 - 8 years
  * The 12-volt battery powers the car's accessories. It can fail due to age or extreme temperatures.
* **Hybrid Battery Degradation:** Frequency: Very, Severity: Moderate, Repair Cost: $2,000 - $4,000, Mileage: 100,000 - 200,000 miles
  * Over time, the hybrid battery can lose capacity, reducing the car's fuel efficiency and performance.

**Other Issues**

* **Brake System Shake:** Frequency: Low, Severity: Low, Repair Cost: $150 - $400, Mileage: 50,000 - 100,000 miles
  * Some Prius models have experienced a shaking sensation in the brake pedal under certain braking conditions.
* **Dashboard Cracks:** Frequency: Moderate, Severity: Low, Repair Cost: $200 - $500, Mileage: 3 - 8 years
  * The dashboard of the Prius is known to crack and warp over time due to sun damage.
* **Rear Seat Folding Issue:** Frequency: Low, Severity: Low, Repair Cost: $100 - $200, Mileage: Constant
  * The rear seats in some Prius models may have trouble folding down properly.
`;

async function run() {
  await fetch(chrome.runtime.getURL("components/chat.html"))
    .then((r) => r.text())
    .then((html) => {
      console.log("hello inserting chat");
      document.body.insertAdjacentHTML("beforeend", html);
      minimizeButton();
      sendButton();
    });

  const carDetails = await getCarDetails();
  if (!carDetails || carDetails.length === 0) {
    console.error("No car details available.");
    return;
  }

  const price = carDetails[0]?.price;
  const yearMakeModel = `${carDetails[1]?.year} ${carDetails[1]?.makemodel}`;
  const odometer = carDetails[2]?.odometer;

  if (!price || !yearMakeModel || !odometer) {
    console.error("Incomplete car details, cannot generate prompt.");
    return;
  }

  const prompt = generateCarIssuePrompt(price, yearMakeModel, odometer);
  console.log("Generated Prompt:", prompt);

  const response = await fetchCarIssues(prompt);
  if (!response) {
    console.error("Failed to fetch car issues.");
    return;
  }

  const carIssuesText = parseCarIssues(response);
  if (carIssuesText) {
    console.log(carIssuesText);
    conversation.push(
      "This is the initial prompt that informs you about the specific car the user is interested in: " +
        prompt
    );
    conversation.push(
      "This is your response of the common issues this car faces: " +
        carIssuesText
    );
  } else {
    console.error("Failed to parse car issues.");
  }

  const issueDetails = extractIssueDetails(carIssuesText);
  console.log(issueDetails);
  createIssues(issueDetails, carDetails);
}

run();

function minimizeButton() {
  const chatBody = document.querySelector(".chat-body");
  const chatHeader = document.querySelector(".chat-header");
  const chatInputContainer = document.querySelector(".chat-input-container");
  const minimizeIcon = document.querySelector(".minimize-icon");
  chatHeader.addEventListener("click", () => {
    chatBody.style.display =
      chatBody.style.display === "none" ? "block" : "none";
    chatInputContainer.style.display =
      chatInputContainer.style.display === "none" ? "flex" : "none";
    minimizeIcon.textContent = minimizeIcon.textContent === "🔼" ? "🔽" : "🔼";
  });
}

function createIssues(issueDetails, carDetails) {
  const chatInsights = document.querySelector(".chat-insights");
  let categories = [];

  const carBuddyIntro = document.createElement("div");
  carBuddyIntro.classList.add("carbuddy-response");
  const yearMakeModel = `${carDetails[1]?.year} ${carDetails[1]?.makemodel}`;
  carBuddyIntro.textContent =
    "Hello! I'm Car Buddy. Here are some common issues a " +
    yearMakeModel +
    " like this might have. Feel free to ask me any additional questions!";
  chatInsights.appendChild(carBuddyIntro);

  for (issue of issueDetails) {
    if (!categories.includes(issue.Category)) {
      categories.push(issue.Category);
      const issueCategory = document.createElement("div");
      issueCategory.classList.add("issue-category");

      const issueCategoryTitle = document.createElement("h2");
      issueCategoryTitle.classList.add("issue-category-title");
      issueCategoryTitle.textContent = issue.Category;
      issueCategory.appendChild(issueCategoryTitle);

      chatInsights.appendChild(issueCategory);
    }
    if (issue.Frequency == undefined || issue.Mileage == undefined) {
      continue;
    }

    const chatIssue = document.createElement("div");
    chatIssue.classList.add("chat-issue");
    if (issue.Frequency.toLowerCase() === "high") {
      chatIssue.classList.add("high-frequency");
    } else if (issue.Frequency.toLowerCase() === "moderate") {
      chatIssue.classList.add("moderate-frequency");
    }

    const issueTitle = document.createElement("h3");
    issueTitle.classList.add("issue-title");
    issueTitle.textContent =
      issue.Severity.toLowerCase() === "extreme"
        ? "🚨 " + issue.Issue
        : issue.Issue;
    chatIssue.appendChild(issueTitle);

    const issueBody = document.createElement("div");
    issueBody.classList.add("issue-body");
    issueBody.innerHTML = `
      <p>Frequency: ${issue.Frequency}</p>
      <p>Severity: ${issue.Severity}</p>
      <p>Repair Cost: ${issue.RepairCost}</p>
      <p>Mileage: ${issue.Mileage}</p>
      <p class="issue-description">${issue.Description}</p>
    `;
    chatIssue.appendChild(issueBody);

    chatIssue.addEventListener("click", () => {
      issueBody.style.display =
        issueBody.style.display === "none" ? "block" : "none";
    });

    const existingCategory = Array.from(
      chatInsights.getElementsByClassName("issue-category")
    ).find(
      (cat) =>
        cat.querySelector(".issue-category-title").textContent ===
        issue.Category
    );

    existingCategory.appendChild(chatIssue);
    hideLoader();
  }
}

function hideLoader() {
  const chatBody = document.querySelector(".chat-body");
  const loaderWrapper = chatBody.querySelector(".loader-wrapper");
  loaderWrapper.style.display = "none";
}

let conversation = [];

const introPrompt = `
you are Car Buddy, an AI car expert that advises the user on the specific car model 
they are currently viewing. Here is the conversation you guys have had. Please answer 
the following question whilst taking context from the past conversation.
This is the start of the conversation. It is purely context for yourself:
`;

async function sendMessage() {
  // if there is something in the text area that is not just spaces
  const messageText = document.querySelector(".chat-input").value.trim();
  if (messageText) {
    const messagePrompt = generateMessagePrompt(
      introPrompt,
      conversation,
      messageText
    );
    document.querySelector(".chat-input").value = "";
    conversation.push("User asked: " + messageText);
    const chatInsights = document.querySelector(".chat-insights");
    const userMessage = document.createElement("div");
    userMessage.classList.add("user-message");
    userMessage.textContent = messageText;
    chatInsights.appendChild(userMessage);
    scrollToBottom();
    const response = await fetchCarIssues(messagePrompt);
    if (!response) {
      console.error("Failed to get a response.");
      return;
    }
    handleChatResponse(response);
  }
}

function handleChatResponse(response) {
  console.log(response.geminiData);
  conversation.push("You responded: " + response.geminiData);
  const chatInsights = document.querySelector(".chat-insights");
  const carBuddyResponse = document.createElement("div");
  carBuddyResponse.classList.add("carbuddy-response");
  carBuddyResponse.textContent = response.geminiData;
  chatInsights.appendChild(carBuddyResponse);
  scrollToBottom();
}

function generateMessagePrompt(introPrompt, conversation, message) {
  generatedMessage = introPrompt;
  conversation.forEach((text) => {
    generatedMessage = generatedMessage + "\n" + text;
  });
  generatedMessage =
    generatedMessage +
    "\nThis is the users question that you should respond to. Ensure your answer only has alphanumerics and punctuations. No special characters like '*' for formatting: " +
    message;
  // cut off from the back based on the max token length we want to allow.
  return generatedMessage;
}

function sendButton() {
  const sendButton = document.querySelector(".send-button");
  sendButton.addEventListener("click", () => {
    sendMessage();
  });
}

function scrollToBottom() {
  const chatBody = document.querySelector(".chat-body");
  chatBody.scrollTop = chatBody.scrollHeight;
}

// TODO: make sure cant press send button unless while waiting for a response.
// TODO: find a way to make it stop returning all the issues again in subsequent responses.
