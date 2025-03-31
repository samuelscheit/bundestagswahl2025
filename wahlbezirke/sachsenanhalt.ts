// INFO:
// SachsenAnhalt contains the column "Andere KWV" (Wählergruppen sowie Einzelbewerberinnen und -bewerber)
// which is not further specified which candidate is meant by this

import fs from "fs";
import csv from "csv-parser";
import { defaultResult, getIdFromName, type ResultType } from "../wahlkreise/scrape";
import { saveResults } from "./wahlbezirke";
import { getGemeindeByID, getRegionByWahlkreis } from "./gemeinden";

const parser = csv({
	separator: ";",
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
	// "Andere KWV",
];

parser.on("data", (data) => {
	const {
		"Wahlkreis Nr.": WahlkreisID,
		Wahlkreisname,
		Kreisschlüssel: KreisID,
		"Kreisfreie Stadt/Landkreis": Kreisname,
		Gemeindeschlüssel: GemeindeID,
		Gemeindename: gemeindeName,
		Verbandgemeindeschlüssel: VerbandsgemeindeID,
		Verbandsgemeindename,
		Wahlbezirk: WahlbezirksID,
		Wahlbezirksname,
		WahlLokal: Art,
		"A - Wahlberechtigte": wahlberechtigte,
		"B - Wähler/-innen": wähler,
		"C - Ungültige Erststimmen": erststimmen_ungültig,
		"D - Gültige Erststimmen": erststimmen_gültig,
		"E - Ungültige Zweitstimmen": zweitstimmen_ungültg,
		"F - Gültige Zweitstimmen": zweitstimmen_gültig,
		//
	} = data;

	let result = defaultResult();
	results.push(result);

	const gemeinde = getGemeindeByID(GemeindeID);

	Object.assign(result, gemeinde);

	result.wahlbezirk_id = getIdFromName(WahlbezirksID);
	result.wahlbezirk_name = Wahlbezirksname;

	result.erststimmen.gültig = Number(erststimmen_gültig) || 0;
	result.zweitstimmen.gültig = Number(zweitstimmen_gültig) || 0;
	result.erststimmen.ungültig = Number(erststimmen_ungültig) || 0;
	result.zweitstimmen.ungültig = Number(zweitstimmen_ungültg) || 0;

	result.anzahl_berechtigte = Number(wahlberechtigte) || 0;
	result.anzahl_wähler = Number(wähler) || 0;

	parteien.forEach((partei, index) => {
		const id = (index + 1).toString().padStart(2, "0");

		const erststimmen = Number(data[`D${id} - ${partei}`]) || 0;
		const zweitstimmen = Number(data[`F${id} - ${partei}`]) || 0;

		result.erststimmen.parteien[partei] = erststimmen;
		result.zweitstimmen.parteien[partei] = zweitstimmen;
	});

	result.erststimmen.parteien["KWV1"] = Number(data["D13 - Andere KWV"]) || 0;
	result.erststimmen.parteien["KWV2"] = Number(data["D14 - Andere KWV"]) || 0;
});

parser.on("end", () => {
	saveResults(results, "15");
});

fs.createReadStream(__dirname + "/data/SachsenAnhalt.csv").pipe(parser);
