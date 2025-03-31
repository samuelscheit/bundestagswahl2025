// INFO:
// SachsenAnhalt contains the column "Andere KWV" (Wählergruppen sowie Einzelbewerberinnen und -bewerber)
// which is not further specified which candidate is meant by this

import fs from "fs";
import csv from "csv-parser";
import { defaultResult, type ResultType } from "../wahlkreise/scrape";
import { saveResults } from "./wahlbezirke";
import { getAGS, getGemeindeByID } from "./gemeinden";
import { getWahlbezirkeVotemanager } from "./votemanager";
import { getWahlbezirkeWAS } from "./WAS";
import { wahlkreiseQuellen } from "../wahlkreise/wahlkreise";

const list = require("./data/wahlbezirkeList.json") as ResultType[];

// data is collected separately through WAS/Votemanager and includes districts/wahlbezirke which this dataset does not include
const separate = new Set([
	"151", // leipzig
	"152", // leipzig 2
	"161", // chemnitz
	"158", // dresden
	"159", // dresden 2
]);

var [votemanagerResult, wasResult] = await Promise.all([
	getWahlbezirkeVotemanager(["Sachsen", "Mittelsachsen"], (opts) => {
		if (opts.url.includes("/14522000/")) return false; // do not fetch 160 mittelsachsen votemanager site
		return true;
	}),
	getWahlbezirkeWAS([...separate.values()].map((x) => wahlkreiseQuellen[x])),
]);

wasResult = wasResult.filter((x) => {
	if (x.wahlkreis_id !== "159") return true;

	// "dresden - bautzen" needs filtering for communes which are on the WAS dresden page and on votemanager
	if (x.gemeinde_name === "Stadt Großröhrsdorf") return false;
	if (x.gemeinde_name === "Stadt Radeberg") return false;
	return true;
});

// const votemanagerResult = [];
// const wasResult = [] as ResultType[];

const existingGemeinden = new Set(
	[...votemanagerResult, ...wasResult]
		.filter((x) => x.bundesland_id === "14")
		.map((x) => {
			if (!x.gemeinde_id) return getAGS(x);

			// both gemeinde AGS and verband AGS
			return [
				getAGS({
					...x,
					gemeinde_id: undefined,
				}),
				getAGS(x),
			];
		})
);

// const seperateResult = list.filter((x) => separate.has(x.wahlbezirk_id!));

const parser = csv({
	separator: ",",
});

const results = [] as ResultType[];

const parteien = [
	"SPD",
	"CDU",
	"AfD",
	"Die Linke",
	"FDP",
	"GRÜNE",
	"FREIE WÄHLER",
	"Die PARTEI",
	"Volt",
	"MLPD",
	"BÜNDNIS DEUTSCHLAND",
	"BSW",
	"PdH",
	"MLPD",
	"Tierschutzpartei",
	"PIRATEN",
	"EB:Busse",
	"EB:Mauer",
	"EB:Schubert",
];

let count = 0;

parser.on("data", (data) => {
	const {
		Wahl,
		EbeneWahlkreis,
		"WK-Nr": WahlkreisNr,
		"WK-Name": Wahlkreisname,
		EbeneOrt,
		AGS,
		Ortname,
		Wahlberechtigte,
		Wähler,
		ungültige_1: erststimmen_ungültig,
		gültige_1: erststimmen_gültig,
		ungültige_2: zweitstimmen_ungültg,
		gültige_2: zweitstimmen_gültig,
		//
	} = data;

	if (separate.has(WahlkreisNr)) return;

	try {
		var gemeinde = getGemeindeByID(AGS);
	} catch (error) {
		throw error;
	}

	if (existingGemeinden.has(AGS)) return;
	if (existingGemeinden.has(getAGS({ ...gemeinde, gemeinde_id: undefined }))) return;

	let result = defaultResult();
	Object.assign(result, gemeinde);

	results.push(result);

	result.wahlbezirk_id = AGS;
	result.wahlbezirk_name = gemeinde.gemeinde_name || Ortname;

	result.erststimmen.gültig = Number(erststimmen_gültig) || 0;
	result.zweitstimmen.gültig = Number(zweitstimmen_gültig) || 0;
	result.erststimmen.ungültig = Number(erststimmen_ungültig) || 0;
	result.zweitstimmen.ungültig = Number(zweitstimmen_ungültg) || 0;

	result.anzahl_berechtigte = Number(Wahlberechtigte) || 0;
	result.anzahl_wähler = Number(Wähler) || 0;

	parteien.forEach((partei, index) => {
		const erststimmen = Number(data[`${partei}_1`]) || 0;
		const zweitstimmen = Number(data[`${partei}_2`]) || 0;

		result.erststimmen.parteien[partei] = erststimmen;
		result.zweitstimmen.parteien[partei] = zweitstimmen;
	});

	count++;
});

parser.on("end", async () => {
	const combined = results.concat(votemanagerResult, wasResult);

	console.log("no voting districts for", count, "gemeinden");

	saveResults(combined, "14");
});

fs.createReadStream(__dirname + "/data/Sachsen.csv").pipe(parser);
