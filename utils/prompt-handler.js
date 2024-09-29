// chrome.storage.local.get(["key"]).then((result) => {
//   });

const carDetails = await chrome.storage.local.get("carDetails");
