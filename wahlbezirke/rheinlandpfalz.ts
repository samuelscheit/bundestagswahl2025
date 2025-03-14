import fs from "fs";
import csv from "csv-parser";
import { defaultResult, getIdFromName, type ResultType } from "../wahlkreise/scrape";
import { axios } from "./axios";
import { getIdFromResult, saveResults } from "./wahlbezirke";

const ID_Regex =
	/^(?:(?<wahlkreisNr>\d{3}))?(?:(?<kreisNr>\d{3}))?(?:(?<verbandsgemeindeNr>\d{2}))?(?:(?<gemeindeNr>\d{3}))?(?:(?<wahlbezirkNr>\d{2}))?/;

// 210 337 07 0000000000

const wahlkreise = {} as Record<string, string>;
const kreise = {} as Record<string, string>;
const kreiseToWahlkreise = {} as Record<string, string>;
const verbandsgemeinden = {} as Record<string, string>;
const verbandsgemeindenToKreise = {} as Record<string, string>;
const gemeinden = {} as Record<string, string>;
const gemeindenToVerbandsgemeinden = {} as Record<string, string>;

type NameNode = {
	bezeichnung: string;
	name: string;
	level: number;
	children?: NameNode[];
};

const [wahlkreisNames, landkreisNames] = await Promise.all([
	axios("https://rlp-btw25.wahlen.23degrees.eu/assets/wk-vec-tree.json"),
	axios("https://rlp-btw25.wahlen.23degrees.eu/assets/lk-vec-tree.json"),
]);

function handleNames(node: NameNode) {
	const id = node.bezeichnung.match(ID_Regex);
	const { wahlkreisNr, kreisNr, verbandsgemeindeNr, gemeindeNr, wahlbezirkNr } = id?.groups || ({} as Record<string, string>);
	const name = node.name;

	if (wahlkreisNr !== "000" && kreisNr === "000" && verbandsgemeindeNr === "00" && gemeindeNr === "000" && wahlbezirkNr === "00") {
		wahlkreise[wahlkreisNr] = name;
	} else if (wahlkreisNr !== "000" && kreisNr !== "000" && verbandsgemeindeNr === "00" && gemeindeNr === "000" && wahlbezirkNr === "00") {
		kreise[kreisNr] = name;
		kreiseToWahlkreise[kreisNr] = wahlkreisNr;
	} else if (wahlkreisNr !== "000" && kreisNr !== "000" && verbandsgemeindeNr !== "00" && gemeindeNr === "000" && wahlbezirkNr === "00") {
		verbandsgemeinden[verbandsgemeindeNr] = name;
		verbandsgemeindenToKreise[verbandsgemeindeNr] = kreisNr;
	} else if (wahlkreisNr !== "000" && kreisNr !== "000" && verbandsgemeindeNr !== "00" && gemeindeNr !== "000" && wahlbezirkNr === "00") {
		gemeinden[gemeindeNr] = name;
		gemeindenToVerbandsgemeinden[gemeindeNr] = verbandsgemeindeNr;
	}

	if (node.children) node.children.forEach(handleNames);
}

wahlkreisNames.data.forEach(handleNames);
landkreisNames.data.forEach(handleNames);

const data = fs.readFileSync(__dirname + "/data/RheinlandPfalz.csv");

const parteien = [
	"SPD",
	"CDU",
	"GRÜNE",
	"FDP",
	"FDP",
	"AfD",
	"FREIE WÄHLER",
	"die Linke",
	"Tierschutzpartei",
	"die PARTEI",
	"Volt",
	"ÖDP",
	"MLPD",
	"BÜNDNIS DEUTSCHLAND",
	"BSW",
	"Ideenschmiede",
];

let previousHeaders = [] as string[];

const parser = csv({
	separator: ";",
	mapHeaders(args) {
		if (previousHeaders.includes(args.header)) {
			args.header = args.header + "_prozent";
		}
		previousHeaders.push(args.header);
		return args.header;
	},
});

const results = [] as ResultType[];

parser.on("data", (data) => {
	const {
		Identifikationsschlüssel: id,
		"Bezeichnung Wahlbezirk": name,
		"A (WB insgesamt)": wahlberechtigte,
		"B Wähler insgesamt": wähler,
		"Urne (U) Briefwahl (W)": art,
		"ungültige Erst": erststimmen_ungültig,
		"gültige Erst": erststimmen_gültig,
		"ungültige Zweit": zweitstimmen_ungültig,
		"gültige Zweit": zweitstimmen_gültig,
	} = data;
	// console.log(data);

	var { wahlkreisNr, kreisNr, verbandsgemeindeNr, gemeindeNr, wahlbezirkNr } = (id.slice(0, 100).match(ID_Regex)?.groups || {}) as Record<
		string,
		string
	>;
	// console.log(wahlkreisNr, kreisNr, gemeindeNr, wahlbezirkNr);
	// gemeindeNr = gemeindeNr.padStart(3, "0");

	const wahlkreisName = wahlkreise[wahlkreisNr];
	const gemeindeName = gemeinden[gemeindeNr];
	const kreisName = kreise[kreisNr];
	const verbandsgemeindeName = verbandsgemeinden[verbandsgemeindeNr];
	const obergruppeName = gemeindeName || verbandsgemeindeName || kreisName || wahlkreisName;

	let result = results.find(
		(x) => x.wahlbezirk_id === wahlbezirkNr && x.gemeinde_id === gemeindeNr && x.kreis_id === kreisNr && x.wahlkreis_id === wahlkreisNr
	);
	if (!result) {
		result = defaultResult();
		results.push(result);
	}

	result.bundesland_id = "7";
	result.bundesland_name = "Rheinland-Pfalz";

	result.wahlbezirk_id = getIdFromName(wahlbezirkNr);
	result.wahlbezirk_name = name;

	result.kreis_name ||= kreisName;
	result.kreis_id = getIdFromName(kreisNr);

	result.gemeinde_name ||= gemeindeName;
	result.gemeinde_id = getIdFromName(gemeindeNr);

	result.wahlkreis_name ||= wahlkreisName;
	result.wahlkreis_id = getIdFromName(wahlkreisNr);

	result.anzahl_berechtigte = Number(wahlberechtigte) || 0;
	result.anzahl_wähler = Number(wähler) || 0;

	parteien.forEach((partei) => {
		const erststimmen = Number(data[`E_${partei}`]) || 0;
		const zweitstimmen = Number(data[`Z_${partei}`]) || 0;

		result.erststimmen.parteien[partei] = erststimmen;
		result.zweitstimmen.parteien[partei] = zweitstimmen;
	});

	result.erststimmen.gültig = Number(erststimmen_gültig) || 0;
	result.zweitstimmen.gültig = Number(zweitstimmen_gültig) || 0;
	result.erststimmen.ungültig = Number(erststimmen_ungültig) || 0;
	result.zweitstimmen.ungültig = Number(zweitstimmen_ungültig) || 0;
});

parser.on("end", () => {
	saveResults(results, "7");
});

parser.write(data);
parser.end();
