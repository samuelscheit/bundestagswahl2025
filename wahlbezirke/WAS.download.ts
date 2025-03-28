import { customWahlkreise } from "../wahlkreise/wahlkreise";
import { saveResults } from "./wahlbezirke";
import { getWahlbezirkeWAS } from "./WAS";

const results = await getWahlbezirkeWAS();

saveResults(results.filter((x) => !customWahlkreise.has(Number(x.wahlkreis_id))));
