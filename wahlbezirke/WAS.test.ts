import { saveResults } from "./wahlbezirke";
import { getUntergebieteWAS, WAS } from "./WAS";

const results = await getUntergebieteWAS("https://www.wahlen-sh.de/btw25/ergebnisse_wahlkreis_2.html");

console.log(results);

saveResults(results);
