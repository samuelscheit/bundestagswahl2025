import fs from "fs";
import { parse } from "node-html-parser";
import { defaultResult, type ResultType } from "../wahlkreise/scrape";

const xml = fs.readFileSync(__dirname + "/data/gesamtergebnis_01.xml", "utf-8");

const root = parse(xml);

export const Bundeswahlleiter = {} as Record<string, ResultType>;

root.querySelectorAll(`[Gebietsart="WAHLKREIS"]`).forEach((x) => {
	const id = x.getAttribute("Gebietsnummer")!;

	const result = defaultResult();

	x.querySelectorAll(`[Gruppenart="ALLGEMEIN"]`).forEach((x) => {
		const name = x.getAttribute("Name")!;
		const [anzahl1, anzahl2] = x.getElementsByTagName("Stimmergebnis").map((x) => Number(x.getAttribute("Anzahl")) || 0);

		if (name === "Wahlberechtigte") {
			result.anzahl_berechtigte = Number(anzahl1);
		} else if (name === "Wähler" || name === "Wählende") {
			result.anzahl_wähler = Number(anzahl1);
		} else if (name === "Ungültige") {
			result.erststimmen.ungültig = Number(anzahl1);
			result.zweitstimmen.ungültig = Number(anzahl2);
		} else if (name === "Gültige") {
			result.erststimmen.gültig = Number(anzahl1);
			result.zweitstimmen.gültig = Number(anzahl2);
		}
	});

	x.querySelectorAll(`[Gruppenart="PARTEI"]`).forEach((x) => {
		const parteiName = x.getAttribute("Name")!.toUpperCase();
		const direktName = x.getAttribute("Direktkandidat");
		const direktStimmen = x.querySelector(`[Stimmart="DIREKT"]`)?.getAttribute("Anzahl");

		const parteiStimmen = x.querySelector(`[Stimmart="LISTE"]`)?.getAttribute("Anzahl");

		if (direktName) result.erststimmen.parteien[direktName] = Number(direktStimmen) || 0;

		result.zweitstimmen.parteien[parteiName] = Number(parteiStimmen) || 0;
	});

	Bundeswahlleiter[id] = result;
});

// console.dir(Wahlkreise, { depth: null });
