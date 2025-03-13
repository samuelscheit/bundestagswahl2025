import { Bundeswahlleiter } from "../bundeswahlleiter/read";
import type { ResultType } from "../wahlkreise/scrape";
import { getIdFromResult } from "./wahlbezirke";
import fs from "fs";

let wahlbezirke = require("./data/wahlbezirkeList.json") as ResultType[];
const indexes = {} as Record<string, number[]>;

const wahlkreisBezirke = {} as Record<string, ResultType[]>;

wahlbezirke.forEach((x, i) => {
	if (!x.bundesland_id) throw new Error("Missing bundesland_id: " + JSON.stringify(x));
	if (!x.wahlkreis_id) throw new Error("Missing wahlkreis_id: " + JSON.stringify(x));
	const wahlbezirk_id = x.wahlbezirk_id || x.wahlbezirk_name;
	if (!wahlbezirk_id) throw new Error("Missing wahlbezirk_id: " + JSON.stringify(x));

	const index = (indexes[getIdFromResult(x)] ||= []);
	index.push(i);

	const wahlkreis_id = parseInt(x.wahlkreis_id).toString();

	const wahlkreis = (wahlkreisBezirke[wahlkreis_id] ||= []);
	wahlkreis.push(x);

	if (!x.wahlbezirk_id) x.wahlbezirk_id = null;

	let stimmen = 0;

	Object.entries(x.zweitstimmen.parteien).forEach(([partei, value]) => {
		stimmen += value;
	});

	if (stimmen !== x.zweitstimmen.gültig) {
		console.error(x);
		throw new Error("Missing Stimmen: " + stimmen + " " + x.zweitstimmen.gültig);
	}
});

Object.keys(Bundeswahlleiter).forEach((wahlkreisId) => {
	const bund = Bundeswahlleiter[wahlkreisId];
	const wahlkreisBezirkeArr = wahlkreisBezirke[wahlkreisId];

	// console.log(Object.keys(wahlkreisBezirke), wahlkreisId);

	if (!bund) throw new Error("Missing bund: " + wahlkreisId);
	// if (!wahlkreisBezirkeArr) throw new Error("Missing wahlkreis: " + wahlkreisId);
});

Object.entries(indexes).forEach(([id, indices]) => {
	if (indices.length !== 1) {
		console.error(
			indices.map((i) => {
				const x = wahlbezirke[i];

				return (x.wahlbezirk_id || "") + " " + (x.wahlbezirk_name || "") + " " + (x.gemeinde_name || x.kreis_name);
			})
		);

		for (const i of indices.slice(1)) {
			wahlbezirke[i] = undefined as any;
		}
	}
});

const filtered = wahlbezirke.filter((x) => x !== undefined && x.wahlkreis_id !== "041");

console.log(wahlbezirke.length - filtered.length, "duplicates");
console.log(filtered.length, "wahlbezirke");

// fs.writeFileSync(__dirname + "/data/wahlbezirkeList.json", JSON.stringify(filtered, null, "\t"));

// Object.entries(bundesland).forEach(([bundesland_id, bund]) => {
// 	Object.entries(bund).forEach(([wahlkreis_id, wahlkreis]) => {
// 		Object.entries(wahlkreis).forEach(([kreis_id, kreis]) => {
// 			Object.entries(kreis).forEach(([gemeinde_id, gemeinde]) => {
// 				Object.entries(gemeinde).forEach(([ortsteil_id, ortsteil]) => {
// 					Object.entries(ortsteil).forEach(([wahlbezirk_id, count]) => {
// 						if (count !== 1) {
// 							console.error(
// 								"Invalid count",
// 								bundesland_id,
// 								wahlkreis_id,
// 								kreis_id,
// 								gemeinde_id,
// 								ortsteil_id,
// 								wahlbezirk_id,
// 								count
// 							);
// 						}
// 					});
// 				});
// 			});
// 		});
// 	});
// });
