import fs from "fs";
import { join } from "path";
import { defaultResult, type ResultType } from "./scrape";

const ID_Regex = /^(?<wahlkreisID>\d{3})(?<kreisID>\d{3})(?<verbandsgemeindeID>\d{2})(?<gemeindeID>\d{3})(?<stadtteilID>\d{2})$/;

function processElectionData(data: string[]) {
	const parties = {
		1: "SPD",
		2: "CDU",
		3: "GRÜNE",
		4: "FDP",
		5: "AfD",
		6: "FREIE WÄHLER",
		7: "Die Linke",
		8: "Tierschutzpartei",
		9: "Die PARTEI",
		10: "Volt",
		11: "ÖDP",
		12: "MLPD",
		13: "BÜNDNIS DEUTSCHLAND",
		14: "BSW",
		15: "Ideenschmiede",
		16: "SONSTIGE",
	} as Record<string, string>;

	const wahlkreise = {} as Record<string, string>;
	const kreise = {} as Record<string, string>;
	const verbandsgemeinden = {} as Record<string, string>;
	const gemeinden = {} as Record<string, string>;

	const partyList = Object.values(parties);

	const results = {} as Record<string, Record<string, ResultType>>;

	data.forEach((line) => {
		line = line.trim();
		if (!line) return;

		// Spalten durch Semikolon trennen
		const fields = line.split(";");

		// Kopfzeile oder unvollständige Zeilen überspringen
		if (fields.length < 10) return;

		const id = fields[0].match(ID_Regex);
		const { wahlkreisID, kreisID, verbandsgemeindeID, gemeindeID, stadtteilID } = id?.groups || ({} as Record<string, string>);
		const name = fields[fields.length - 1];

		if (wahlkreisID !== "000" && kreisID === "000" && verbandsgemeindeID === "00" && gemeindeID === "000" && stadtteilID === "00") {
			wahlkreise[wahlkreisID] = name;
		} else if (
			wahlkreisID !== "000" &&
			kreisID !== "000" &&
			verbandsgemeindeID === "00" &&
			gemeindeID === "000" &&
			stadtteilID === "00"
		) {
			kreise[kreisID] = name;
		} else if (
			wahlkreisID !== "000" &&
			kreisID !== "000" &&
			verbandsgemeindeID !== "00" &&
			gemeindeID === "000" &&
			stadtteilID === "00"
		) {
			verbandsgemeinden[verbandsgemeindeID] = name;
		} else if (
			wahlkreisID !== "000" &&
			kreisID !== "000" &&
			verbandsgemeindeID !== "00" &&
			gemeindeID !== "000" &&
			stadtteilID === "00"
		) {
			gemeinden[gemeindeID] = name;
		}

		const wahlkreisName = wahlkreise[wahlkreisID];
		const kreisName = kreise[kreisID];
		const verbandsgemeindeName = verbandsgemeinden[verbandsgemeindeID];
		const gemeindeName = gemeinden[gemeindeID];
		const stadtTeilName = name.split("/").slice(1).join("/");
		const obergruppeName = wahlkreisID + " - " + (gemeindeName || verbandsgemeindeName || kreisName || wahlkreisName);

		console.log("Wahlkreis:", wahlkreisName, wahlkreisID);
		console.log("Kreis:", kreisName, kreisID);
		console.log("Verbandsgemeinde:", verbandsgemeindeName, verbandsgemeindeID);
		console.log("Gemeinde:", gemeindeName, gemeindeID);
		console.log("Stadtteil:", stadtTeilName, stadtteilID, fields[0]);
		if (stadtteilID === "00") return;

		const result = defaultResult();

		result.anzahl_berechtigte = parseInt(fields[1]) || 0;
		result.anzahl_wähler = parseInt(fields[6]) || 0;
		result.erststimmen.gültig = parseInt(fields[11]) || 0;
		result.zweitstimmen.gültig = parseInt(fields[115]) || 0;

		// Erststimmen verarbeiten (Felder 14-63)
		Object.keys(parties).forEach((partyId, i) => {
			const fieldIdx = 13 + i;
			if (fields[fieldIdx] && /^\d+$/.test(fields[fieldIdx])) {
				result.erststimmen.parteien[parties[partyId]] = parseInt(fields[fieldIdx]);
			}
		});

		// Zweitstimmen verarbeiten (Felder 118-167)
		Object.keys(parties).forEach((partyId, i) => {
			const fieldIdx = 117 + i;
			if (fields[fieldIdx] && /^\d+$/.test(fields[fieldIdx])) {
				result.zweitstimmen.parteien[parties[partyId]] = parseInt(fields[fieldIdx]);
			}
		});

		if (!results[obergruppeName]) results[obergruppeName] = {};

		results[obergruppeName][stadtTeilName] = result;
	});

	return results;
}

const data = fs.readFileSync(join(__dirname + "/data/RheinlandPfalz.csv"), "utf-8").split("\n");

const results = processElectionData(data);

fs.writeFileSync(join(__dirname + "/data/RheinlandPfalz.json"), JSON.stringify(results, null, "\t"));
