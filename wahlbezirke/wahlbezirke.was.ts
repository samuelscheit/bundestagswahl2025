import { saveResults } from "./wahlbezirke";
import { getWahlbezirkeWAS } from "./WAS";

const results = await getWahlbezirkeWAS();

saveResults(results);
