import { behoerden_queue, queues, saveResults } from "./wahlbezirke";
import { getUntergebieteWAS, WAS } from "./WAS";

const results = await getUntergebieteWAS("https://wahlen.dresden.de/2025/btw/ergebnisse_briefwahlbezirk_01000.html");

console.log(results);

await Promise.all(queues.map((x) => x.onIdle()));

saveResults(results);
