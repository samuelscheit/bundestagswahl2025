import { getUntergebieteWAS, WAS } from "./WAS";

const result = await getUntergebieteWAS("https://wahlen-berlin.de/wahlen/BU2025/afspraes/ergebnisse_stimmbezirk_01100.html");

console.log(result);
