const carMakeMap = {
  bmw: "bmw",
  mercedes: "mercedes-benz",
  "mercedes-benz": "mercedes-benz",
  chevy: "chevrolet",
  lexus: "lexus",
  toyota: "toyota",
};

export function getMakeModel(allCarDetails) {
  const make = allCarDetails[1].makemodel.split(" ")[0].toLowerCase();
  const model = allCarDetails[1].makemodel.split(" ")[1];

  let normalizedMake = carMakeMap[make] || make;
  let normalizedModel;

  switch (normalizedMake) {
    case "toyota":
      if (model == "scion") {
        normalizedMake = "scion";
        normalizedModel = allCarDetails[1].makemodel.split(" ")[2];
      } else {
        normalizedModel = model;
      }
      break;
    case "bmw":
      if (isDigit(model.slice(0, 1))) {
        normalizedModel = model[0] + "-series";
      } else {
        normalizedModel = model;
      }
      break;
    case "mercedes-benz":
      let mercedesClass = "";
      for (let char of model) {
        if (!isDigit(char)) {
          mercedesClass += char;
        }
      }
      if (mercedesClass.length < 4) {
        normalizedModel = mercedesClass + "-class";
      } else {
        normalizedModel = allCarDetails[1].makemodel.split(" ").join("-");
      }
      break;
    case "lexus":
      let lexusModel = "";
      for (let char of model) {
        if (!isDigit(char)) {
          lexusModel += char;
        }
      }
      normalizedModel = lexusModel;
      break;
    default:
      normalizedModel = model;
      break;
  }

  return normalizedMake + "/" + normalizedModel;
}

function isDigit(str) {
  return /^\d+$/.test(str);
}
