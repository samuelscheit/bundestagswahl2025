import { behoerden_queue, queues, saveResults } from "./wahlbezirke";
import { getUntergebieteWAS, WAS } from "./WAS";

// const results = await getUntergebieteWAS(	"https://www.wahlen-muenchen.de/ergebnisse/20250223bundestagswahl/ergebnisse_gemeinde_162000.html");
const results = await getUntergebieteWAS(
	"https://wahlen.osrz-akdb.de/uf-p/677000/248/20250223/bundestagswahl_kwl_1_wk/ergebnisse_wahlkreis_248.html"
);
// const results = await getUntergebieteWAS("https://wahlen-berlin.de/wahlen/BU2025/afspraes/ergebnisse_gemeinde_11.html");
// const results = await getUntergebieteWAS("https://www.wahlen-hamburg.de/Bundestagswahl_2025/");
//

console.log(results);

await Promise.all(queues.map((x) => x.onIdle()));

saveResults(results);
