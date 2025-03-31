import fs from "fs";
import csv from "csv-parser";
import { defaultResult, getIdFromName, type ResultType } from "../wahlkreise/scrape";
import { getIdFromResult, saveResults } from "./wahlbezirke";
import { getGemeinde, getGemeindeByID, getRegionByWahlkreis } from "./gemeinden";

const data = fs.readFileSync(__dirname + "/data/Thüringen.csv");

const parteien = [
	"AfD",
	"SPD",
	"CDU",
	"Die Linke",
	"FDP",
	"GRÜNE",
	"FREIE WÄHLER",
	"VOLT",
	"MLPD",
	"BÜNDNIS DEUTSCHLAND",
	"BSW",
	// "einzelbewerber",
];

const parser = csv({
	skipLines: 4,
	separator: ";",
	headers: [
		"stand",
		"satzart",
		"wahlkreisNr",
		"kreisNr",
		"gemeindeNr",
		"wahlbezirkNr",
		"name",
		"Gemeinde mit eigenem Briefwahlbezirk",
		"abgebend nach Gemeinde/Wahlbezirk",
		"aufnehmend von Gemeinde/Wahlbezirk",
		"insgesamt_anzahl_wahlbezirke",
		"erfasste_anzahl_wahlbezirke",
		"wahlberechtigte",
		"wähler",
		"wahlbeteiligung",
		"erststimmen_ungültig",
		"erststimmen_gültig",
		"zweitstimmen_ungültig",
		"zweitstimmen_gültig",
		// parteien: AfD, SPD, CDU, Die Linke, FDP, GRÜNE, FREIE WÄHLER, VOLT, MLPD, BÜNDNIS DEUTSCHLAND, BSW, einzelbewerber
		"erststimmen_AfD_absolut",
		"erststimmen_AfD_prozent",
		"zweitstimmen_AfD_absolut",
		"zweitstimmen_AfD_prozent",

		"erststimmen_SPD_absolut",
		"erststimmen_SPD_prozent",
		"zweitstimmen_SPD_absolut",
		"zweitstimmen_SPD_prozent",

		"erststimmen_CDU_absolut",
		"erststimmen_CDU_prozent",
		"zweitstimmen_CDU_absolut",
		"zweitstimmen_CDU_prozent",

		"erststimmen_Die Linke_absolut",
		"erststimmen_Die Linke_prozent",
		"zweitstimmen_Die Linke_absolut",
		"zweitstimmen_Die Linke_prozent",

		"erststimmen_FDP_absolut",
		"erststimmen_FDP_prozent",
		"zweitstimmen_FDP_absolut",
		"zweitstimmen_FDP_prozent",

		"erststimmen_GRÜNE_absolut",
		"erststimmen_GRÜNE_prozent",
		"zweitstimmen_GRÜNE_absolut",
		"zweitstimmen_GRÜNE_prozent",

		"erststimmen_FREIE WÄHLER_absolut",
		"erststimmen_FREIE WÄHLER_prozent",
		"zweitstimmen_FREIE WÄHLER_absolut",
		"zweitstimmen_FREIE WÄHLER_prozent",

		"erststimmen_VOLT_absolut",
		"erststimmen_VOLT_prozent",
		"zweitstimmen_VOLT_absolut",
		"zweitstimmen_VOLT_prozent",

		"erststimmen_MLPD_absolut",
		"erststimmen_MLPD_prozent",
		"zweitstimmen_MLPD_absolut",
		"zweitstimmen_MLPD_prozent",

		"erststimmen_BÜNDNIS DEUTSCHLAND_absolut",
		"erststimmen_BÜNDNIS DEUTSCHLAND_prozent",
		"zweitstimmen_BÜNDNIS DEUTSCHLAND_absolut",
		"zweitstimmen_BÜNDNIS DEUTSCHLAND_prozent",

		"erststimmen_BSW_absolut",
		"erststimmen_BSW_prozent",
		"zweitstimmen_BSW_absolut",
		"zweitstimmen_BSW_prozent",

		"erststimmen_einzelbewerber1_absolut",
		"erststimmen_einzelbewerber1_prozent",
		"erststimmen_einzelbewerber2_absolut",
		"erststimmen_einzelbewerber2_prozent",
	],
});

const results = [] as ResultType[];

const wahlkreise = {} as Record<string, string>;
const gemeinden = {} as Record<string, string>;
const romanNumeral = / (I|II|III|IV|V|VI|VII|VIII|IX|X)/;

parser.on("data", (data) => {
	const { wahlkreisNr, kreisNr, gemeindeNr, wahlbezirkNr, name, satzart } = data as Record<string, string>;

	if (wahlkreisNr !== "000" && kreisNr === "00" && gemeindeNr === "000" && wahlbezirkNr === "0000") {
		wahlkreise[wahlkreisNr] = name;
	} else if (gemeindeNr !== "000" && wahlbezirkNr === "0000") {
		gemeinden[gemeindeNr] = name;
	}

	const wahlkreisName = wahlkreise[wahlkreisNr];
	const gemeindeName = gemeinden[gemeindeNr];

	if (satzart !== "") return;

	const result = defaultResult();
	results.push(result);

	const RegionNr = getRegionByWahlkreis(wahlkreisNr);

	if (gemeindeNr === "000") {
		try {
			var gemeinde = getGemeinde(name.replaceAll("LG ", "").replaceAll("VG ", "").replace(romanNumeral, "").replace(/\d+/g, ""));
			if (gemeinde.bundesland_id !== "16") throw new Error("Not in Thüringen");
			if (gemeinde.kreis_id !== kreisNr) throw new Error("Kreis ID mismatch");
		} catch (error) {
			var gemeinde = getGemeindeByID(`16${RegionNr}${kreisNr}${gemeindeNr}`);
		}
	} else {
		var gemeinde = getGemeindeByID(`16${RegionNr}${kreisNr}${gemeindeNr}`);
	}

	Object.assign(result, gemeinde);

	result.wahlbezirk_id = getIdFromName(wahlbezirkNr);
	result.wahlbezirk_name = name;

	result.anzahl_berechtigte = Number(data.wahlberechtigte) || 0;
	result.anzahl_wähler = Number(data.wähler) || 0;
	result.briefwahl = result.anzahl_berechtigte === 0;

	parteien.forEach((partei) => {
		const erststimmen = Number(data[`erststimmen_${partei}_absolut`]) || 0;
		const zweitstimmen = Number(data[`zweitstimmen_${partei}_absolut`]) || 0;

		result.erststimmen.parteien[partei] = erststimmen;
		result.zweitstimmen.parteien[partei] = zweitstimmen;
	});

	result.erststimmen.gültig = Number(data.erststimmen_gültig) || 0;
	result.zweitstimmen.gültig = Number(data.zweitstimmen_gültig) || 0;
	result.erststimmen.ungültig = Number(data.erststimmen_ungültig) || 0;
	result.zweitstimmen.ungültig = Number(data.zweitstimmen_ungültig) || 0;
});

parser.on("end", () => {
	saveResults(results, "16");
});

parser.write(data);
parser.end();
