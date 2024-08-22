// Registering this listener when the script is first executed ensures that the
// offscreen document will be able to receive messages when the promise returned
// by `offscreen.createDocument()` resolves.
chrome.runtime.onMessage.addListener(handleMessages);

// This function performs basic filtering and error checking on messages before
// dispatching the message to a more specific message handler.
async function handleMessages(message) {
  // Return early if this message isn't meant for the offscreen document.
  if (message.target !== 'offscreen') {
    return false;
  }

  // Dispatch the message to an appropriate handler.
  switch (message.type) {
    case 'retrieve-svg-object-url':
      getKbbSvg(message.data);
      break;
    case 'retrieve-body-styles':
      retrieveBodyStyles(message.data);
      break;
    default:
      console.warn(`Unexpected message type received: '${message.type}'.`);
      return false;
  }
}

function getKbbSvg(htmlString) {
  const parser = new DOMParser();
  const document = parser.parseFromString(htmlString, 'text/html');
  const svgObject = document.querySelector('object[title^="price advisor"]');

  // Get the URL of the SVG file
  const svgUrl = svgObject.getAttribute('data');
  sendToBackground(
    'svg-object-url-result',
    svgUrl
  );

}

function retrieveBodyStyles(htmlString) {
  const parser = new DOMParser();
  const document = parser.parseFromString(htmlString, 'text/html');

  // Select the container div
  const boxStyle = document.getElementById('box-style');

  // Select all radio buttons inside the container div
  const radioButtons = boxStyle.querySelectorAll('input[type="radio"]');

  // Create an empty array to store the names
  const buttonNames = [];

  // Loop through each radio button and extract its name
  radioButtons.forEach((radioButton) => {
    const name = radioButton.getAttribute('name');
    buttonNames.push(name);
  });

  sendToBackground(
    'body-styles-result',
    buttonNames
  );

}

function sendToBackground(type, data) {
  chrome.runtime.sendMessage({
    type,
    target: 'background',
    data
  });
}