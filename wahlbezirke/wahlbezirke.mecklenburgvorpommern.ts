import axios from "axios";
import fs from "fs";
import iconv from "iconv-lite";
import csv from "csv-parser";
import { defaultResult, type ResultType } from "./scrape";

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

const results = {} as Record<string, Record<string, ResultType>>;

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
		Gemeindename: gemeinde,
		"Ungültige Stimmen": ungültige,
		"Gültige Stimmen": gültige,
		Wahlberechtigte,
		Wähler,
		Wahlbezirksname: wahlbezirk,
	} = data;

	if (Ausgabe !== "A") return; // nur absolute Zahlen keine Prozente

	const obergruppeName = data.Gemeindename;

	if (!results[obergruppeName]) results[obergruppeName] = {};
	if (!results[obergruppeName][wahlbezirk]) results[obergruppeName][wahlbezirk] = defaultResult();

	const result = results[obergruppeName][wahlbezirk];

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
	const wahlbezirke = require("./data/wahlbezirke.json");

	Object.assign(wahlbezirke, results);

	fs.writeFileSync(__dirname + "/data/wahlbezirke.json", JSON.stringify(wahlbezirke, null, "\t"));
});

parser.write(data);
parser.end();
