import { getBundeswahlleiterDaten } from "../bundeswahlleiter/read";
import { defaultResult, type ResultType } from "../wahlkreise/scrape";
import { wahlkreiseBundesland, wahlkreiseNamen } from "../wahlkreise/wahlkreise";
import { cleanGemeindeName } from "./gemeinden";
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
		throw new Error("Missing Stimmen: " + stimmen + " " + x.zweitstimmen.gültig + " " + x.gemeinde_name + " " + x.kreis_name);
	}

	if (stimmen >= 5000 && x.anzahl_berechtigte !== 0 && x.bundesland_id !== "14") {
		// not briefwahlbezirke and not sachsen (missing data)
		console.error("Many Stimmen for one urnen Wahlbezirk", stimmen, x.gemeinde_name);
		// throw new Error("Too many Stimmen for one urnen Wahlbezirk: " + stimmen);
	}

	mergePartei(x.zweitstimmen, "SPD", "spd");
	mergePartei(x.zweitstimmen, "CDU", "cdu");
	mergePartei(x.zweitstimmen, "AfD", "afd");
	mergePartei(x.zweitstimmen, "FDP", "fdp");
	mergePartei(x.zweitstimmen, "GRÜNE", "grüne");
	mergePartei(x.zweitstimmen, "GRÜNE", "GRÜNE/B 90");
	mergePartei(x.zweitstimmen, "FREIE WÄHLER", "freie wähler");
	mergePartei(x.zweitstimmen, "Volt", "volt");
	mergePartei(x.zweitstimmen, "PIRATEN", "Piratenpartei Deutschland");
	mergePartei(x.zweitstimmen, "MLPD", "mlpd");
	mergePartei(x.zweitstimmen, "BÜNDNIS DEUTSCHLAND", "bündnis deutschland");
	mergePartei(x.zweitstimmen, "BSW", "bsw");
	mergePartei(x.zweitstimmen, "Die Linke", "linke");
	mergePartei(x.zweitstimmen, "Die Linke", "die Linke");
	mergePartei(x.zweitstimmen, "Die Linke", "DIE LINKE");
	mergePartei(x.zweitstimmen, "Die PARTEI", "die PARTEI");
	mergePartei(x.zweitstimmen, "PdH", "Partei der Humanisten");
	mergePartei(x.zweitstimmen, "PdH", "Die Humanisten");
	mergePartei(x.zweitstimmen, "Team Todenhöfer", "Die Gerechtigkeitspartei - Team Todenhöfer");
	mergePartei(x.zweitstimmen, "Team Todenhöfer", "Die Gerechtigkeitspartei – Team Todenhöfer"); // gedankenstrich statt bindestrich
	mergePartei(x.zweitstimmen, "Team Todenhöfer", "Team Toden");
	mergePartei(x.zweitstimmen, "PdF", "Partei des Fortschritts");
	mergePartei(x.zweitstimmen, "MERA25", "MERA25 - Gemeinsam für Europäische Unabhängigkeit");
});

function mergePartei(result: ResultType["zweitstimmen"], a: string, b: string) {
	let aValue = result.parteien[a];
	let bValue = result.parteien[b];

	if (aValue == undefined && bValue == undefined) return;

	aValue ||= 0;
	bValue ||= 0;

	result.parteien[a] = aValue + bValue;
	delete result.parteien[b];
}

const Bundeswahlleiter = getBundeswahlleiterDaten("gesamtergebnis_02.xml");

const wahlkreis = "159";
const bezirke = wahlkreisBezirke[wahlkreis] || [];

const gemeinden = new Set(bezirke.map((x) => x.gemeinde_name || x.verband_name));
let total = 0;

gemeinden.forEach((gemeinde) => {
	let wähler = 0;

	bezirke.forEach((bezirk) => {
		if (bezirk.gemeinde_name !== gemeinde && bezirk.verband_name !== gemeinde) return;

		wähler += bezirk.anzahl_wähler;
	});

	console.log(gemeinde, wähler);
});

bezirke.forEach((bezirk) => {
	total += bezirk.anzahl_wähler;
});

if (gemeinden.size === 1) {
	for (const bezirk of bezirke) {
		console.log(bezirk.wahlbezirk_name, bezirk.anzahl_wähler);
	}
}

console.log(bezirke.filter((x) => x.gemeinde_name === null && x.verband_name === null));

const bundTotal = Bundeswahlleiter[wahlkreis]?.anzahl_wähler || 0;

console.log("____________________");
console.log("total", wahlkreis, wahlkreiseNamen[wahlkreis], total, "should be", bundTotal, "diff", total - bundTotal);

const toDelete = new Set<string>();

// duplicate check
// done in second pass because wahlkreisBezirke is needed
wahlbezirke.forEach((x) => {
	if (!x.gemeinde_name) return;

	if (x.wahlbezirk_name === x.gemeinde_name && x.anzahl_berechtigte !== 0) {
		// only one wahlbezirk per gemeinde
		// anzahl_berechtigte needs to be not 0	=> otherwise briefwahlbezirke might falsely match
		// either missing wahlbezirke data => do nothing
		// or both gemeinde and wahlbezirk data exist => delete gemeinde data

		const wahlkreisBezirkeArr = wahlkreisBezirke[x.wahlkreis_id as any];
		if (!wahlkreisBezirkeArr) return;

		const b = cleanGemeindeName(x.gemeinde_name);

		let match = null as null | ResultType;
		let wählerSum = 0;
		let countMatches = 0;

		for (const wahlbezirk of wahlkreisBezirkeArr) {
			if (!wahlbezirk.gemeinde_name) continue;
			if (wahlbezirk === x) continue;

			const a = cleanGemeindeName(wahlbezirk.gemeinde_name);

			if (a === b || a.includes(b) || b.includes(a)) {
				wählerSum += wahlbezirk.anzahl_wähler;
				match = wahlbezirk;
				countMatches++;
			}
		}

		const diff = Math.abs(x.anzahl_wähler - wählerSum);
		const avg = wählerSum / countMatches;
		const percentage = x.anzahl_wähler / avg;

		if (match && ((diff < 50 && percentage >= 3.9) || percentage > 10)) {
			toDelete.add(getIdFromResult(x));
			console.log("delete", x.gemeinde_name, match.gemeinde_name, x.wahlkreis_name, {
				wählerSum,
				countMatches,
				avg,
				anzahl_wähler: x.anzahl_wähler,
				percentage,
				diff,
			});
		}
	}
});

console.log(toDelete.size, " double gemeinde and wahlbezirk data");

let totalDiffWähler = 0;

Object.keys(Bundeswahlleiter).forEach((wahlkreisId) => {
	try {
		const bund = Bundeswahlleiter[wahlkreisId];
		const wahlkreisBezirkeArr = wahlkreisBezirke[wahlkreisId];

		if (!bund) throw new Error("Missing bund: " + wahlkreisId);
		// if (wahlkreiseBundesland[wahlkreisId] === "14") return; // sachsen has no wahlbezirk data
		// if (wahlkreisId === "258") return; // stuttgart has no wahlbezirk data
		if (!wahlkreisBezirkeArr) throw new Error("Missing wahlkreis: " + wahlkreisId);

		const accumulated = defaultResult();

		wahlkreisBezirkeArr.forEach((wahlbezirk) => {
			accumulated.anzahl_berechtigte += wahlbezirk.anzahl_berechtigte;
			accumulated.anzahl_wähler += wahlbezirk.anzahl_wähler;
		});

		const diffWähler = Math.abs(accumulated.anzahl_wähler - bund.anzahl_wähler);
		totalDiffWähler += diffWähler;

		if (diffWähler > 1000) {
			console.error("wrong voter count", wahlkreisId, accumulated.anzahl_wähler, bund.anzahl_wähler, diffWähler);
			throw new Error("Wrong voter count: " + wahlkreisId + " " + accumulated.anzahl_wähler + " " + bund.anzahl_wähler);
		}
	} catch (error) {
		// throw error;
	}
});

console.error("total diff voter count", totalDiffWähler);

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

const remove_wahlkreise = [
	// "190",
	// "191",
	// "192",
	// "198",
	// "199",
	// "201",
	// "203",
	// "206",
	// "207",
	// "150",
	// "151",
	// "152",
	// "153",
	// "154",
	// "155",
	// "156",
	// "157",
	// "158",
	// "159",
	// "160",
	// "161",
	// "162",
	// "163",
	// "164",
	// "165",
] as string[];

const filtered = wahlbezirke.filter(
	(x) => x !== undefined && x.wahlkreis_id !== "00" && !toDelete.has(getIdFromResult(x)) && !remove_wahlkreise.includes(x.wahlkreis_id!)
);

console.log(Object.keys(wahlkreisBezirke).length, "wahlkreise");

Object.entries(wahlkreiseNamen).forEach(([wahlkreis_id, name]) => {
	if (wahlkreisBezirke[wahlkreis_id]) return;

	console.error("Missing wahlkreis", wahlkreis_id, name);
});

console.log(wahlbezirke.length - filtered.length, "duplicates");
console.log(filtered.length, "wahlbezirke");

fs.writeFileSync(__dirname + "/data/wahlbezirkeList.json", JSON.stringify(filtered, null, "\t"));

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
