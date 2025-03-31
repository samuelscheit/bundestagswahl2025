import { HTMLElement, parse } from "node-html-parser";
import {
	defaultResult,
	getIdFromName,
	getIdFromNameWithLeading,
	getNameWithoutId,
	type Options,
	type ResultType,
} from "../wahlkreise/scrape";
import { behoerden_queue, gemeinde_queue, queues, wahlbezirke_queue, wahleintrage_queue } from "./wahlbezirke";
import { wahlkreiseBundesland, wahlkreiseQuellen } from "../wahlkreise/wahlkreise";
import { axiosWithRedirect } from "./axios";
import {
	getGemeindeWahlkreis,
	getGemeindeByID,
	AGS,
	getGemeindeByIDOrNull,
	getGemeindeByWahlkreisAndGemeindeId,
	getGemeinde,
	getGemeindeOrNull,
} from "./gemeinden";
import { assignOptional } from "./util";

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

	const wahlbezirksName = root.querySelector(".gebiet .header-gebiet__name")?.structuredText.trim();
	if (!wahlbezirksName) {
		throw new Error("WahlbezirksName not found: " + options.url);
	}

	const links = gebietBreadcrumb
		?.querySelectorAll("li a")
		.map((x) => {
			const href = x.getAttribute("href");
			if (!href) return;

			const name = x.structuredText.trim();
			if (!name) return;

			return { name, href };
		})
		.filter(Boolean) as { name: string; href: string }[];

	if (!links.some((x) => x.href === options.url)) {
		links.push({
			href: options.url.split("/").pop()!,
			name: wahlbezirksName,
		});
	}

	let stimmbezirk_id = undefined as undefined | string;

	links.forEach(({ name, href }) => {
		const idHref = href.split("_").at(-1)!;

		const id = getIdFromName(idHref || "") || getIdFromName(name);
		const types = [
			...href.matchAll(
				/_(gesamt|land|verwaltungsgemeinschaft|verbandsgemeinde|amt|samtgemeinde|kreis|wahlkreis|stadtbezirk|stadtviertel|stadtteil|ortsteil|ortschaft|statistikgebiet|gemeinde|kreisfreie_stadt|wahlbezirk|stimmbezirk|briefwahlbezirk)_/g
			),
		];
		if (!types) throw new Error("Type not found: " + href + " " + options.url);
		const type = types.at(-1)?.[1];

		if (!type) throw new Error("Type not found: " + href + " " + options.url);

		const cleanName = getNameWithoutId(name);

		if (type === "gesamt") {
			// multiple combined wahlkreise
		} else if (type === "land") {
			result.bundesland_name ||= cleanName;
			result.bundesland_id ||= id;
		} else if (type === "verwaltungsgemeinschaft" || type === "verbandsgemeinde" || type === "amt" || type === "samtgemeinde") {
			if (result.kreis_name && type === "amt") {
				result.gemeinde_name ||= cleanName;
				result.gemeinde_id ||= id;
			} else {
				result.verband_name ||= cleanName;
				result.verband_id ||= id;
			}
		} else if (type === "kreis") {
			result.kreis_name ||= cleanName;
			result.kreis_id ||= id;
		} else if (type === "wahlkreis") {
			result.wahlkreis_name ||= cleanName;
			result.wahlkreis_id ||= getIdFromName(name) || id;
		} else if (type === "stadtbezirk" || type === "stadtviertel") {
			// do not include
		} else if (type === "stadtteil" || type === "ortsteil" || type === "ortschaft" || type === "statistikgebiet") {
			result.ortsteil_id ||= id;
			result.ortsteil_name ||= cleanName;
		} else if (type === "gemeinde" || type === "kreisfreie_stadt") {
			result.gemeinde_id ||= getIdFromNameWithLeading(idHref) || getIdFromNameWithLeading(name);
			result.gemeinde_name ||= cleanName;
		} else if (type === "wahlbezirk" || type === "stimmbezirk" || type === "briefwahlbezirk") {
			stimmbezirk_id = getIdFromNameWithLeading(idHref) || getIdFromNameWithLeading(name)!;
		} else {
			throw new Error("Unknown gebiet: " + href + " " + options.url);
		}
	});

	// if (options.url.includes("wahlen-berlin.de")) {
	// 	result.gemeinde_id = `11000000`;
	// } else if (options.url.includes("nuernberg.de")) {
	// 	if (result.gemeinde_id === "565000") {
	// 		// schwabach
	// 		result.gemeinde_id = `09565000`;
	// 	} else {
	// 		result.gemeinde_id = `09564000`;
	// 	}
	// }

	let gemeinde: ReturnType<typeof getGemeindeByID> | null = null;

	do {
		if (result.gemeinde_id) {
			if (!result.wahlkreis_id) {
				throw new Error("Gemeinde not found: " + result.gemeinde_id + " " + options.url);
			}
			if (!result.bundesland_id) result.bundesland_id = wahlkreiseBundesland[result.wahlkreis_id];

			if (result.gemeinde_id === "3360021" && result.bundesland_id == "3") {
				result.gemeinde_id = "3360030";
			}

			if (stimmbezirk_id) {
				gemeinde = getGemeindeByIDOrNull(stimmbezirk_id.slice(0, 8));
				if (gemeinde) break;
			}

			gemeinde = getGemeindeByIDOrNull(result.gemeinde_id);
			if (gemeinde) break;

			let gemeinde_id = result.bundesland_id!.padStart(2, "0") + result.gemeinde_id;
			gemeinde = getGemeindeByIDOrNull(gemeinde_id);
			if (gemeinde) break;

			gemeinde_id = "0" + result.gemeinde_id;
			gemeinde = getGemeindeByIDOrNull(gemeinde_id);
			if (gemeinde) break;

			gemeinde = getGemeindeByWahlkreisAndGemeindeId(result.wahlkreis_id, result.gemeinde_id);
			if (gemeinde) break;

			if (!result.gemeinde_name) break;

			gemeinde = getGemeindeOrNull(result.gemeinde_name!, result.kreis_name || undefined);
			console.error(gemeinde?.gemeinde_name, result.gemeinde_name);

			if (gemeinde) break;

			console.error("Gemeinde not found: " + result.gemeinde_id + " " + options.url, gemeinde);
			var x = 2;
			console.log(x);
		}
	} while (false);
	if (gemeinde) Object.assign(result, gemeinde);

	const id = getIdFromName(wahlbezirksName);

	result.wahlbezirk_name = wahlbezirksName;
	result.wahlbezirk_id = id;

	do {
		if (result.kreis_name) {
			result.gemeinde_name ||= result.kreis_name;
		} else if (result.verband_name) {
			result.gemeinde_name ||= result.verband_name;
		} else if (result.wahlkreis_id) {
			const isStadt = links.some((x) => x.href.includes("stadt"));
			if (!isStadt) break;

			const gemeinde = getGemeindeWahlkreis(result.wahlkreis_id);
			if (!gemeinde) break;
			// nur städte die ganze wahlkreise füllen
			if (gemeinde.gemeinde_id !== "0") break;

			Object.assign(result, gemeinde);
		}
	} while (false);

	if (!result.gemeinde_name) {
		throw new Error("Gemeinde name not found: " + options.url);
	}

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

	if (result.anzahl_wähler === 0) {
		root.querySelectorAll(
			`[data-tablejigsaw-downloadable-filename="Kennzahlen"] tbody tr, table:has([data-sort*="insgesamt"]) tbody tr`
		)?.forEach((row) => {
			const cells = row.querySelectorAll("td");
			if (cells.length !== 2) return;

			const [name, value] = cells.map((x) => x.structuredText.trim());
			const val = Number(value.replace(/\./g, "")) || 0;

			if (name.includes("Wahlberechtigte insgesamt")) {
				result.anzahl_berechtigte = val;
			} else if (name.includes("Wählende insgesamt") || name.includes("Wähler insgesamt")) {
				result.anzahl_wähler = val;
			}
		});
	}

	return result;
}

export async function getUntergebieteWAS(url: string, depth = 0, cache = {} as Record<string, number>) {
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

					const sub_results = await getUntergebieteWAS(unterurl, depth + 1, cache);

					results = results.concat(sub_results);
				} catch (error) {
					throw new Error("Error " + unterurl + " " + (error as Error).message);
				}
			})
		);

		return results;
	}
	// unterste ebene => Wahlbezirke

	const result = WAS({
		id: "",
		text: "",
		root,
		url,
	});

	const id = "" + result.wahlkreis_id + result.kreis_id + result.gemeinde_id + result.wahlbezirk_id + result.wahlbezirk_name;

	if (cache[id]) {
		cache[id]++;
		result.wahlbezirk_name = result.wahlbezirk_name + " " + cache[id];
	} else {
		cache[id] = 1;
	}

	return [result];
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
