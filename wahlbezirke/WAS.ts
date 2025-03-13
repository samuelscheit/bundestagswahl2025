import { HTMLElement, parse } from "node-html-parser";
import { defaultResult, getIdFromName, type Options, type ResultType } from "../wahlkreise/scrape";
import { behoerden_queue, gemeinde_queue, queues, wahlbezirke_queue, wahleintrage_queue } from "./wahlbezirke";
import { wahlkreiseQuellen } from "../wahlkreise/wahlkreise";
import { axiosWithRedirect } from "./axios";
import { getWahlbezirkVotemanager } from "./votemanager";

export function WAS(options: Options & { text: string; root?: HTMLElement }) {
	const root = options.root || parse(options.text);

	const table = root.querySelector(`.tablesaw.table-stimmen[data-tablejigsaw], .tablesaw.table-stimmen[data-tablejigsaw-downloadable]`);
	if (!table) throw new Error("Table not found:" + options.url);

	const rows = table.querySelectorAll("tbody tr").concat(table.querySelectorAll("tfoot tr"));

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

	let gebietBreadcrumb = root.querySelector(`.gebiet ul.breadcrumb`);
	if (!gebietBreadcrumb) gebietBreadcrumb = root.querySelector(`.gebietwaehler .dropdown__content .linklist.header-gebiet__obergebiete`);

	gebietBreadcrumb?.querySelectorAll("li a").forEach((x) => {
		const href = x.getAttribute("href");
		if (!href) return;

		const name = x.structuredText.trim();
		if (!name) return;

		const id = getIdFromName(name) || getIdFromName(href);

		if (href.includes("_gesamt_")) {
			// multiple combined wahlkreise
		} else if (href?.includes("_land_")) {
			result.bundesland_name ||= name;
			result.bundesland_id ||= id;
		} else if (
			href?.includes("_kreis_") ||
			href?.includes("_verwaltungsgemeinschaft_") ||
			href?.includes("_verbandsgemeinde_") ||
			href?.includes("_amt_") ||
			href.includes("_samtgemeinde_")
		) {
			result.kreis_name ||= name;
			result.kreis_id ||= id;
		} else if (href?.includes("_wahlkreis_")) {
			result.wahlkreis_name ||= name;
			result.wahlkreis_id ||= id;
		} else if (href?.includes("_stadtbezirk_") || href.includes("_stadtviertel_")) {
			// do not include
		} else if (
			href?.includes("_stadtteil_") ||
			href?.includes("_ortsteil_") ||
			href.includes("_ortschaft_") ||
			href.includes("_statistikgebiet_")
		) {
			result.ortsteil_id ||= id;
			result.ortsteil_name ||= name;
		} else if (href?.includes("_gemeinde_") || href.includes("_kreisfreie_stadt_")) {
			result.gemeinde_id ||= id;
			result.gemeinde_name ||= name;
		} else {
			throw new Error("Unknown gebiet: " + href + " " + options.url);
		}
	});

	const wahlbezirksName = root.querySelector(".gebiet .header-gebiet__name")?.structuredText.trim();
	if (!wahlbezirksName) {
		throw new Error("WahlbezirksName not found: " + options.url);
	}

	const id = getIdFromName(wahlbezirksName);

	result.wahlbezirk_name = wahlbezirksName;
	result.wahlbezirk_id = id;

	result.gemeinde_name ||= wahlbezirksName;
	result.gemeinde_id ||= id;

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

		if (partei.includes("berechtigt")) {
			result.anzahl_berechtigte = anzahl1;
		} else if (partei.includes("Wähler") || partei.includes("Wählende")) {
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

export async function getUntergebieteWAS(url: string, depth = 0) {
	var { data: html, status, url } = await axiosWithRedirect(url, { responseType: "text" });

	if (status >= 400) throw new Error(`Request failed with status code ${status} ${url}`);

	if (html?.type && html?.data) {
		html = Buffer.from(html.data).toString("utf-8");
	}

	const isWAS = html?.includes("jigsaw");
	if (!isWAS) {
		return [];
	}

	const root = parse(html);
	const gebiete = root.querySelectorAll(".gebietwaehler .dropdown__content .linklist:not(.header-gebiet__obergebiete) a");
	let base = !url.endsWith("/") ? url.split("/").slice(0, -1).join("/") : url;
	base += "/";

	const gebietName = root.querySelector(".header-gebiet__name")!.structuredText;

	console.log(gebietName, url);

	if (gebiete.length !== 0) {
		let results = [] as ResultType[];

		const queue = queues[depth];
		if (!queue) throw new Error("Queue not found: " + depth + " " + url);

		await queue.addAll(
			gebiete.map((x) => async () => {
				var unterurl = url;
				try {
					unterurl = base + x.getAttribute("href");

					const sub_results = await getUntergebieteWAS(unterurl, depth + 1);

					results = results.concat(sub_results);
				} catch (error) {
					throw new Error("Error " + unterurl + " " + (error as Error).message);
				}
			})
		);

		return results;
	}
	// unterste ebene => Wahlbezirke

	return [
		WAS({
			id: "",
			text: "",
			root,
			url,
		}),
	];
}

export async function getWahlbezirkeWAS(sources?: string[]) {
	if (!sources) sources = Object.values(wahlkreiseQuellen);

	let results = [] as ResultType[];

	await behoerden_queue.addAll(
		sources.map((x) => async () => {
			const result = await getUntergebieteWAS(x, 1);

			results = results.concat(result);
		})
	);

	await behoerden_queue.onIdle();
	await gemeinde_queue.onIdle();
	await wahleintrage_queue.onIdle();
	await wahlbezirke_queue.onIdle();

	return results;
}
