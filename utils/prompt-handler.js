// chrome.storage.local.get(["key"]).then((result) => {
//     console.log("Value is " + result.key);
//   });

const carDetails = await chrome.storage.local.get("carDetails");
