import fs from "fs";
import csv from "csv-parser";
import { defaultResult, getIdFromName, type ResultType } from "../wahlkreise/scrape";
import { axios } from "./axios";
import { getIdFromResult, saveResults } from "./wahlbezirke";
import { getGemeinde, getGemeindeByID, getRegionByWahlkreis } from "./gemeinden";

const ID_Regex =
	/^(?<wahlkreisNr>\d{3})(?<regionNr>\d{1})(?<kreisNr>\d{2})(?<verbandsgemeindeNr>\d{2})(?<gemeindeNr>\d{3})(?<wahlbezirkNr>\d{2})?/;

// 210 337 07 0000000000

const wahlkreise = {} as Record<string, string>;
const kreise = {} as Record<string, string>;
const kreiseToWahlkreise = {} as Record<string, string>;
const verbandsgemeinden = {} as Record<string, string>;
const verbandsgemeindenToKreise = {} as Record<string, string>;
const gemeinden = {} as Record<string, string>;
const wahlbezirke = {} as Record<string, number>;
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

	var { wahlkreisNr, regionNr, kreisNr, verbandsgemeindeNr, gemeindeNr, wahlbezirkNr } = (id.slice(0, 100).match(ID_Regex)?.groups ||
		{}) as Record<string, string>;
	// console.log(wahlkreisNr, kreisNr, gemeindeNr, wahlbezirkNr);
	// gemeindeNr = gemeindeNr.padStart(3, "0");

	if (wähler === "") return; // gemeinde zu klein => hat keine daten => wird in samtgemeinde zusammengefasst

	var gemeindeId =
		Number(gemeindeNr) === 0
			? Number(verbandsgemeindeNr) === 0
				? "000"
				: "5" + verbandsgemeindeNr.padStart(3, "0")
			: gemeindeNr.padStart(3, "0");

	try {
		var gemeinde = getGemeindeByID(`07${regionNr}${kreisNr}${gemeindeId}`);

		if (gemeinde.wahlkreis_id !== getIdFromName(wahlkreisNr)) {
			// @ts-ignore
			gemeinde = gemeinde._gemeinden.find((g) => g.wahlkreis_id === getIdFromName(wahlkreisNr));
		}
		if (gemeinde.kreis_id !== getIdFromName(kreisNr)) {
			console.log(gemeinde, wahlkreisNr, regionNr, kreisNr, verbandsgemeindeNr, gemeindeNr, wahlbezirkNr, name);
			throw new Error("Gemeinde ID does not match kreis ID");
		}
		if (gemeinde.region_id !== getIdFromName(regionNr)) {
			console.log(gemeinde, wahlkreisNr, regionNr, kreisNr, verbandsgemeindeNr, gemeindeNr, wahlbezirkNr, name);
			throw new Error("Gemeinde ID does not match region ID");
		}
	} catch (error) {
		throw error;
		const wahlkreisName = wahlkreise[wahlkreisNr];
		const gemeindeName = gemeinden[gemeindeNr];
		const kreisName = kreise[kreisNr];
		const verbandsgemeindeName = verbandsgemeinden[verbandsgemeindeNr];
		const obergruppeName = gemeindeName || verbandsgemeindeName || kreisName || wahlkreisName;
		const obergruppeNr = gemeindeNr !== "000" ? gemeindeNr : verbandsgemeindeNr !== "00" ? verbandsgemeindeNr : kreisNr;

		var gemeinde = getGemeinde(name, kreisName);

		console.log("Fallback", gemeinde.gemeinde_name, obergruppeName, name, `07${regionNr}${kreisNr}${gemeindeId}`);
	}

	if (Number(gemeindeNr) === 0 && Number(verbandsgemeindeNr) !== 0) {
		// console.log(gemeinde.name)
	}

	const idResult = wahlkreisNr + kreisNr + verbandsgemeindeNr + gemeindeNr + wahlbezirkNr + name;
	var wahlbezirk_name = name;

	if (wahlbezirke[idResult]) {
		wahlbezirke[idResult]++;
		wahlbezirk_name = wahlbezirk_name + " " + wahlbezirke[idResult];
	} else {
		wahlbezirke[idResult] = 1;
	}

	const result = defaultResult();
	results.push(result);

	Object.assign(result, gemeinde);

	result.wahlbezirk_id = getIdFromName(wahlbezirkNr);
	result.wahlbezirk_name = wahlbezirk_name;

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
