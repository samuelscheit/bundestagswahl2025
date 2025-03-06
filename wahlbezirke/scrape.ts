import { HTMLElement, parse } from "node-html-parser";
import * as cheerio from "cheerio";
import iconv from "iconv-lite";
import csv from "csv-parser";
import { axiosWithRedirect } from "./wahlbezirke";

// @ts-ignore
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

export interface Options {
	url: string;
	id: string;
	errors?: number;
}

export async function download(options: Options) {
	if (!options.errors) options.errors = 0;

	var { data } = await axiosWithRedirect(options.url, {
		responseType: "arraybuffer",
	});

	if (options.url.includes("https://wahlen.thueringen.de")) {
		data = iconv.decode(Buffer.from(data), "ISO-8859-1");
	} else {
		data = Buffer.from(data).toString("utf8");
	}

	return handleData({ ...options, text: data });
}

function handleData(options: Options & { text: string }) {
	const { text, url } = options;

	if (text.includes("data-tablejigsaw")) return WAS(options);
	if (text.includes("vue_ergebnis_container_web_init")) return votemanager(options);
	if (url.includes("https://wahlen.thueringen.de")) return thueringen(options);
	if (url.includes("wahlen.sachsen.de")) return sachsen(options);
	if (url.includes("sachsen-anhalt.de")) return sachsenAnhalt(options);
	if (url.includes("wahlen.mvnet.de")) return mecklenburgVorpommern(options);
	if (options.url.includes("wahl.krzn.de")) return krzn(options);
	if (options.url.includes("23degrees.eu")) return degreesEU(options);

	return;
	// throw new Error("Unknown data type");
}

export function defaultResult() {
	return {
		erststimmen: {
			gültig: 0,
			ungültig: 0,
			parteien: {} as Record<string, number>,
		},
		zweitstimmen: {
			gültig: 0,
			ungültig: 0,
			parteien: {} as Record<string, number>,
		},
		anzahl_wähler: 0,
		anzahl_berechtigte: 0,
	};
}

export type ResultType = ReturnType<typeof defaultResult>;

export function WAS(options: Options & { text: string; root?: HTMLElement }) {
	const root = options.root || parse(options.text);

	const table = root.querySelector(`.tablesaw.table-stimmen[data-tablejigsaw], .tablesaw.table-stimmen[data-tablejigsaw-downloadable]`);
	if (!table) throw new Error("Table not found:" + options.url);

	const rows = table.querySelectorAll("tbody tr");

	const result = defaultResult();

	let ZweitstimmenHeader = table.querySelector(`thead tr th[data-sort="Zweitstimmen"]`);
	if (ZweitstimmenHeader) {
		var zweitStimmenSwap = ZweitstimmenHeader.previousElementSibling?.getAttribute("data-sort") !== "Erststimmen";
	} else {
		ZweitstimmenHeader = table.querySelector(`thead tr th[data-sort="Zweitstimme"]`);
		if (ZweitstimmenHeader) {
			var zweitStimmenSwap = ZweitstimmenHeader?.previousElementSibling?.getAttribute("data-sort") !== "Erststimme";
		}
	}

	rows.forEach((row) => {
		const headers = row.querySelectorAll("th");
		let cells = row.querySelectorAll("td");

		const [partei, direktmandat] = headers.map((x) => x.structuredText.trim());

		if (cells.length === 7 || cells.length === 5) cells = cells.slice(1);
		if (cells.length !== 6 && cells.length !== 4) throw new Error("Invalid row count: " + cells.length + " " + options.url);

		if (cells.length === 4) {
			var [anzahl1, anteil1, anzahl2, anteil2] = cells.map((x) => Number(x.text.replace(/\./g, "")) || 0);
		} else {
			var [anzahl1, anteil1, gewinnVerlust1, anzahl2, anteil2, gewinnVerlust2] = cells.map(
				(x) => Number(x.text.replace(/\./g, "")) || 0
			);
		}

		if (zweitStimmenSwap) {
			[anzahl1, anzahl2] = [anzahl2, anzahl1];
		}

		if (partei === "Wahlberechtigte") {
			result.anzahl_berechtigte = anzahl1;
		} else if (partei === "Wähler" || partei === "Wählende") {
			result.anzahl_wähler = anzahl1;
		} else if (partei.includes("Ungültig")) {
			result.erststimmen.ungültig = anzahl1;
			result.zweitstimmen.ungültig = anzahl2;
		} else if (partei.includes("Gültig")) {
			result.erststimmen.gültig = anzahl1;
			result.zweitstimmen.gültig = anzahl2;
		} else {
			result.erststimmen.parteien[partei] = anzahl1;
			result.zweitstimmen.parteien[partei] = anzahl2;
		}
	});

	return result;
}

export async function votemanager(options: Options & { text: string }) {
	const { searchParams, origin, pathname } = new URL(options.url);
	const wahl_id = searchParams.get("wahl_id")!;
	const id = searchParams.get("id")!;

	const baseUrl = origin + pathname.replace("/praesentation/ergebnis.html", "");
	const apiUrl = baseUrl + (options.text.includes("../api") ? "/api/praesentation" : "/daten/api");

	console.log({ baseUrl, apiUrl, url: options.url });

	return votemanagerWithOptions({ url: apiUrl, wahl_id, ebene_id: id });
}

export async function votemanagerWithOptions({ ebene_id, url, wahl_id }: { url: string; wahl_id: string; ebene_id: string }) {
	const results = await Promise.all([
		axiosWithRedirect(`${url}/wahl_${wahl_id}/ergebnis_${ebene_id}_0.json`, { responseType: "json" }),
		axiosWithRedirect(`${url}/wahl_${wahl_id}/ergebnis_${ebene_id}_1.json`, { responseType: "json" }),
	]);

	const result = defaultResult();

	const hasError = results.find((x) => !x.data.Komponente?.tabelle);
	if (hasError)
		throw new Error(`${url} ${wahl_id} ${ebene_id} Keine Daten ${hasError.data.Komponente?.hinweis_auszaehlung || "Keine Ergebnisse"}`);

	const [stimme1, stimme2] = results.map((x) => {
		const parteien = {} as Record<string, number>;
		let gültig = 0;
		let ungültig = 0;

		x.data.Komponente.tabelle.zeilen.forEach((row: any) => {
			parteien[row.label.labelKurz] = Number(row.zahl.replace(/\./g, "")) || 0;
		});

		x.data.Komponente.info.tabelle.zeilen.forEach((row: any) => {
			const zahl = Number(row.zahl.replace(/\./g, "")) || 0;
			if (row.label.labelKurz === "Wahlberechtigte") {
				result.anzahl_berechtigte = zahl;
			} else if (row.label.labelKurz === "Wähler") {
				result.anzahl_wähler = zahl;
			} else if (row.label.labelKurz === "ungültige Stimmen") {
				ungültig = zahl;
			} else if (row.label.labelKurz === "gültige Stimmen") {
				gültig = zahl;
			}
		});

		return { parteien, gültig, ungültig };
	});

	result.erststimmen = stimme1;
	result.zweitstimmen = stimme2;

	return result;

	// https://wahlen.regioit.de/1/bt2025/05334002/praesentation/ergebnis.html?wahl_id=97&stimmentyp=1&id=ebene_2_id_114
	// https://wahlen.regioit.de/1/bt2025/05334002/daten/api/wahl_97/ergebnis_ebene_2_id_114_1.json
}

async function degreesEU(options: Options & { text: string }) {
	const id = options.url.split("/").at(-2);
	const base = new URL(options.url).origin;

	const { data } = await axiosWithRedirect(`${base}/assets/json/${id}.json`, { responseType: "json" });

	const result = defaultResult();

	data.tables
		.filter((x: any) => x.page === "details")
		.forEach((table: any) => {
			const { mode } = table;

			const stimmen = mode === "erststimmen" ? result.erststimmen : result.zweitstimmen;

			table.data.forEach((row: any) => {
				const value = Number(row.a);
				if (row.rowHeader === "Wahlberechtigte") {
					result.anzahl_berechtigte = value;
				} else if (row.rowHeader === "Wähler/Wahlbeteiligung") {
					result.anzahl_wähler = value;
				} else if (row.rowHeader.includes("ungültige")) {
					stimmen.ungültig = value;
				} else if (row.rowHeader.includes("gültige")) {
					stimmen.gültig = value;
				} else if (row.rowHeader.includes("Sonstige")) {
					// exclude
				} else {
					stimmen.parteien[row.rowHeader] = value;
				}
			});
		});

	return result;
}

async function thueringen(options: Options & { text: string }) {
	const $ = cheerio.load(options.text, {});

	const wahlübersicht = $(`table[border="0"][cellspacing="0"][cellpadding="0"]`);

	const result = defaultResult();

	const metadaten = $(`table[border="0"]:not([cellspacing]):not([cellpadding])`);

	result.anzahl_berechtigte = Number(metadaten.find("tr").eq(1).find("td").eq(1).text().replace(/[.\s]/g, ""));
	result.anzahl_wähler = Number(metadaten.find("tr").eq(2).find("td").eq(1).text().replace(/[.\s]/g, ""));

	wahlübersicht.find("td.oben table tbody").map((i, el) => {
		const arr = $(el).find("tr").toArray();
		const type = $(arr[0]).text().trim();
		const ungültigeStimmen = Number($(arr[1]).find("div").eq(1).text().replace(/[.\s]/g, ""));
		const gültigeStimmen = Number($(arr[1]).find("div").eq(3).text().replace(/[.\s]/g, ""));

		const stimmen = type === "Zweitstimme" ? result.zweitstimmen : result.erststimmen;

		stimmen.gültig = gültigeStimmen;
		stimmen.ungültig = ungültigeStimmen;

		arr.slice(4).map((x) => {
			const count = $(x).find("td").length;
			const name = $(x).find("td").eq(1).text().trim();

			if (count === 8) {
				var anzahl = Number($(x).find("td").eq(3).text().replace(/[.\s]/g, ""));
			} else if (count === 7) {
				var anzahl = Number($(x).find("td").eq(2).text().replace(/[.\s]/g, ""));
			} else {
				throw new Error("Invalid count: " + count + " " + options.url);
			}

			stimmen.parteien[name] = anzahl;
		});
	});

	return result;

	// console.log(stimmen.toArray());
}

async function krzn(options: Options & { text: string }) {
	const root = parse(options.text);

	const download = root.querySelector(`[title="Download CSV-Datei - Ergebnisse Wahlkreise"]`);
	if (!download) throw new Error("Download not found:" + options.url);

	const baseUrl = options.url.slice(0, options.url.lastIndexOf("/"));
	const downloadUrl = baseUrl + "/" + download.getAttribute("href");

	const { data } = await axiosWithRedirect(downloadUrl, { responseType: "text" });

	const file = csv({
		skipLines: 1,
		separator: ";",
	});

	const results = [] as any[];

	await new Promise((resolve) => {
		file.write(data);
		file.on("data", (data) => {
			results.push(data);
		});
		file.on("end", () => {
			resolve(results);
		});
		file.end();
	});

	const [namen] = results;
	const bezirksErgebnis = results.find((x) => x.NR === options.id);

	const { WAHLDATUM, WAHLART, GEBIET, EBENE, NR, BEZEICHNUNG, ANZAHL_GESAMT, ANZAHL_FERTIG } = bezirksErgebnis as Record<string, string>;

	const result = defaultResult();

	result.anzahl_berechtigte = Number(bezirksErgebnis.A);
	result.anzahl_wähler = Number(bezirksErgebnis.B);

	result.erststimmen.gültig = Number(bezirksErgebnis.D);
	result.erststimmen.ungültig = Number(bezirksErgebnis.C);

	result.zweitstimmen.gültig = Number(bezirksErgebnis.F);
	result.zweitstimmen.ungültig = Number(bezirksErgebnis.E);

	const erststimmen = Object.keys(bezirksErgebnis).filter((x) => x.startsWith("D") && x.length > 1);
	const zweitstimmen = Object.keys(bezirksErgebnis).filter((x) => x.startsWith("F") && x.length > 1);

	erststimmen.forEach((key) => {
		const partei = namen[key];
		const anzahl = Number(bezirksErgebnis[key]) || 0;

		result.erststimmen.parteien[partei] = anzahl;
	});

	zweitstimmen.forEach((key) => {
		const partei = namen[key];
		const anzahl = Number(bezirksErgebnis[key]) || 0;

		result.zweitstimmen.parteien[partei] = anzahl;
	});

	return result;
}

async function sachsen(options: Options & { text: string }) {
	const root = parse(options.text);

	const table = root.querySelector(`#tab-stimmenverteilung .table-wahlen`);
	if (!table) throw new Error("Table not found:" + options.url);

	const rows = table.querySelectorAll("tbody tr");

	const result = defaultResult();

	const [ungültig, gültig, ...parteien] = rows.map((row) => {
		const name = row.querySelector("th")!.structuredText.trim();
		const [stimme1, prozent1, stimme2, prozent2] = row
			.querySelectorAll("td")
			.map((x) => Number(x.structuredText.replace(/[.\s]/g, "")) || 0);

		return [name, stimme1, stimme2] as const;
	});

	result.erststimmen.ungültig = ungültig[1];
	result.erststimmen.gültig = gültig[1];

	result.zweitstimmen.ungültig = ungültig[2];
	result.zweitstimmen.gültig = gültig[2];

	parteien.forEach((row, i) => {
		const [name, stimme1, stimme2] = row;

		result.erststimmen.parteien[name] = stimme1;
		result.zweitstimmen.parteien[name] = stimme2;
	});

	const metadaten = root.querySelector(`#tab-wahlbeteiligung .table-wahlen tbody`);
	if (!metadaten) throw new Error("Metadaten not found:" + options.url);

	result.anzahl_berechtigte =
		Number(metadaten.querySelector(`[headers="wahlberechtigte absolut"]`)!.structuredText.replace(/[.\s]/g, "")) || 0;
	result.anzahl_wähler = Number(metadaten.querySelector(`[headers="waehler absolut"]`)!.structuredText.replace(/[.\s]/g, "")) || 0;

	return result;
}

async function sachsenAnhalt(options: Options & { text: string }) {
	const root = parse(options.text);

	const table = root.querySelector(`#textlinks .tablewrap`);
	if (!table) throw new Error("Table not found:" + options.url);

	const rows = table.querySelectorAll("tr");
	const split = {} as Record<string, HTMLElement[]>;
	let current: HTMLElement[] = [];

	for (const row of rows) {
		if (row.querySelector(`td[colspan="4"]`)) {
			current = [];
			split[row.structuredText] = current;
		} else {
			current.push(row);
		}
	}

	const result = defaultResult();

	Object.entries(split).map(([key, x]) => {
		const stimmen = key === "Erststimmen" ? result.erststimmen : result.zweitstimmen;

		return x.map((x) => {
			const labels = x
				.querySelectorAll("td.g")
				.map((x) => {
					if (x.innerText === "&nbsp;") return;

					return x.structuredText.trim();
				})
				.filter(Boolean) as string[];
			const values = x.querySelectorAll("td.w").map((x) => {
				return Number(x.structuredText.replace(/[.\s]/g, "")) || 0;
			});
			if (!labels.length || !values.length) return;

			console.log(labels, values, key);

			const [label] = labels;
			const [value] = values;

			if (label === "Wahlberechtigte") {
				result.anzahl_berechtigte = value;
			} else if (label.includes("Wähler")) {
				result.anzahl_wähler = value;
			} else if (label.includes("Ungültige")) {
				stimmen.ungültig = value;
			} else if (label.includes("Gültige")) {
				stimmen.gültig = value;
			} else if (!key.includes("Wähler")) {
				stimmen.parteien[label] = value;
			}
		});
	});

	return result;
}

async function mecklenburgVorpommern(options: Options & { text: string }) {
	const { chart_data_st2, chart_data_st1 } = eval(`${options.text}; ({chart_data_st2, chart_data_st1})`);

	const stimme1 = chart_data_st1[`WK${options.id}`];
	const stimme2 = chart_data_st2[`WK${options.id}`];

	const result = defaultResult();

	[...stimme1, ...stimme2].forEach((x) => {
		x.stimmen = Number(x.stimmen.replace(/[.\s]/g, "")) || 0;
	});

	stimme1.forEach((x: any) => {
		result.erststimmen.parteien[x.partei] = x.stimmen;
	});

	stimme2.forEach((x: any) => {
		result.zweitstimmen.parteien[x.partei] = x.stimmen;
	});

	return result;
}
