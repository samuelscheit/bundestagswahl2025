import axios from "axios";
import fs from "fs";
import iconv from "iconv-lite";
import csv from "csv-parser";
import { defaultResult, getIdFromName, type ResultType } from "../wahlkreise/scrape";
import { saveResults } from "./wahlbezirke";
import { AGS, getGemeinde, getGemeindeByID, getGemeindeByIDOrNull, getGemeindeOrNull } from "./gemeinden";

const arraybuffer = await axios<ArrayBuffer>("https://wahlen.mvnet.de/dateien/ergebnisse.2025/bundestagswahl/csv/b_wahlbezirke.csv", {
	responseType: "arraybuffer",
});
const buffer = Buffer.from(arraybuffer.data);
const data = iconv.decode(buffer, "iso-8859-1").toString();

fs.writeFileSync(__dirname + "/data/MecklenburgVorpommern.csv", data);

const parser = csv({
	skipLines: 5,
	separator: ";",
});

const results = [] as ResultType[];

const parteien = [
	"SPD",
	"AfD",
	"CDU",
	"Die Linke",
	"FDP",
	"GRÜNE",
	"Tierschutzpartei",
	"FREIE WÄHLER",
	"Volt",
	"MLPD",
	"BÜNDNIS DEUTSCHLAND",
	"BSW",
	"Einzelbewerber",
];

parser.on("data", (data) => {
	const {
		Ausgabe,
		"Erst-/Zweitstimme": art,
		"Ungültige Stimmen": ungültige,
		"Gültige Stimmen": gültige,
		Wahlberechtigte,
		Wähler,
		Gemeindename: gemeindeName,
		Gemeinde: GemeindeID,
		Wahlbezirksname,
		Wahlbezirk: WahlbezirksID,
		Kreis: KreisID,
		Kreisname,
		Wahlkreis: WahlkreisID,
		Wahlkreisname,
		Amt: AmtID,
		Amtname,
	} = data;

	if (Ausgabe !== "A") return; // nur absolute Zahlen keine Prozente

	let result = results.find((x) => x.wahlbezirk_id === WahlbezirksID && x.gemeinde_id === GemeindeID);
	if (!result) {
		result = defaultResult();
		results.push(result);
	}

	do {
		var gemeinde = getGemeindeByIDOrNull(GemeindeID);
		if (gemeinde) break;
		gemeinde = getGemeindeOrNull(gemeindeName, Kreisname);
	} while (false);

	if (!gemeinde || !gemeinde.gemeinde_name) {
		var { land, region, kreis } = (GemeindeID.match(AGS)?.groups || {}) as Record<string, string | undefined>;
		gemeinde = getGemeindeByID(`${land}${region}${kreis}${AmtID}`);
	}

	Object.assign(result, gemeinde);
	result.briefwahl = Wahlbezirksname.includes("Briefwahl");
	result.wahlbezirk_id = getIdFromName(WahlbezirksID);
	result.wahlbezirk_name = Wahlbezirksname;

	const berechtigte = parseInt(Wahlberechtigte) || 0;
	const wähler = parseInt(Wähler) || 0;

	if (berechtigte !== 0) result.anzahl_berechtigte = berechtigte;
	if (wähler !== 0) result.anzahl_wähler = wähler;

	const gültigeStimmen = parseInt(gültige) || 0;
	const ungültigeStimmen = parseInt(ungültige) || 0;

	const stimmen = art === "1" ? result.erststimmen : result.zweitstimmen;

	if (gültigeStimmen !== 0) stimmen.gültig = gültigeStimmen;
	if (ungültigeStimmen !== 0) stimmen.ungültig = ungültigeStimmen;

	parteien.forEach((partei) => {
		const value = parseInt(data[partei]) || 0;

		if (value !== 0) stimmen.parteien[partei] = value;
	});
});
parser.on("end", () => {
	saveResults(results, "13");
});

parser.write(data);
parser.end();
