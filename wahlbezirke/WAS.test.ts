import { getUntergebieteWAS, WAS } from "./WAS";

const result = await getUntergebieteWAS("https://wahlergebnis.saarland.de/GRW/ergebnisse_gemeinde_41519.html");

console.log(result);
