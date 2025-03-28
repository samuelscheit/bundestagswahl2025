import { saveResults } from "./wahlbezirke";
import { getUntergebieteWAS, WAS } from "./WAS";

const results = await getUntergebieteWAS("https://wahlergebnisse.halle.de/BTW2025/");

console.log(results);

saveResults(results);
