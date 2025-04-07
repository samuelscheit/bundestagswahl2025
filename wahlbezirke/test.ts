import { calculatePercentage, ResultType } from "../wahlkreise/scrape";
// import { wahlergebnis } from "./accumulate";
const data = require("./data/wahlbezirkeList.json") as ResultType[];

// let max_parties: Record<
// 	string,
// 	{
// 		party: string;
// 		percentage: number;
// 		entries: {
// 			percentage: number;
// 			gemeinde_name: string;
// 		}[];
// 	}
// > = {};

// for (const land_id in wahlergebnis) {
// 	for (const region_id in wahlergebnis[land_id]) {
// 		for (const kreis_id in wahlergebnis[land_id][region_id]) {
// 			for (const verband_id in wahlergebnis[land_id][region_id][kreis_id]) {
// 				for (const gemeinde_id in wahlergebnis[land_id][region_id][kreis_id][verband_id]) {
// 					const gemeinde = wahlergebnis[land_id][region_id][kreis_id][verband_id][gemeinde_id];
// 					if (!gemeinde?.result) continue;
// 					const entry = gemeinde.result;

// 					const percentages = calculatePercentage(entry.zweitstimmen)!;

// 					if (!percentages) {
// 						console.error("No percentages found for", entry);
// 						throw new Error("No percentages found");
// 					}

// 					Object.entries(percentages).forEach(([party, percentage]) => {
// 						if (!max_parties[party]) {
// 							max_parties[party] = {
// 								party,
// 								percentage,
// 								entries: [
// 									{
// 										percentage,
// 										gemeinde_name: entry.gemeinde_name!,
// 									},
// 								],
// 							};
// 						} else if (percentage > max_parties[party].percentage) {
// 							max_parties[party].percentage = percentage;
// 							max_parties[party].entries.push({
// 								percentage,
// 								gemeinde_name: entry.gemeinde_name!,
// 								wähler: entry.anzahl_wähler,
// 							});
// 						}
// 					});
// 				}
// 			}
// 		}
// 	}
// }

// const sorted = Object.values(max_parties).sort((a, b) => b.percentage - a.percentage);

// console.table(sorted);

console.log(data.length);
