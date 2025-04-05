import { behoerden_queue, queues, saveResults } from "./wahlbezirke";
import { getUntergebieteWAS, WAS } from "./WAS";

const results = await getUntergebieteWAS("https://www.wahlen-hamburg.de/Bundestagswahl_2025/");

console.log(results);

await Promise.all(queues.map((x) => x.onIdle()));

saveResults(results);
