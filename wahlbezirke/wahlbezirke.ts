import fs from "fs";
import PQueue from "p-queue";
import type { ResultType } from "../wahlkreise/scrape";
import { bundeslandNamen, wahlkreiseBundesland, wahlkreiseNamen } from "../wahlkreise/wahlkreise";

export const concurrency = 10;

export const bundesland_queue = new PQueue({ concurrency });
export const behoerden_queue = new PQueue({ concurrency });
export const gemeinde_queue = new PQueue({ concurrency });
export const verbund_queue = new PQueue({ concurrency });
export const wahleintrage_queue = new PQueue({ concurrency });
export const wahlbezirke_queue = new PQueue({ concurrency });

export const queues = [behoerden_queue, bundesland_queue, wahleintrage_queue, gemeinde_queue, verbund_queue, wahlbezirke_queue];

export function getIdFromResult(x: ResultType) {
	if (!x.wahlkreis_id) throw new Error("Missing wahlkreis_id: " + JSON.stringify(x));
	x.wahlkreis_id = String(parseInt(x.wahlkreis_id));

	if (!x.wahlkreis_name) x.wahlkreis_name = wahlkreiseNamen[x.wahlkreis_id];

	x.bundesland_id = wahlkreiseBundesland[x.wahlkreis_id as any as keyof typeof wahlkreiseBundesland];
	if (!x.bundesland_id) throw new Error("Missing bundesland_id: " + JSON.stringify(x));

	x.bundesland_name = bundeslandNamen[x.bundesland_id as any as keyof typeof bundeslandNamen];

	return (
		"" +
		(x.bundesland_id || x.bundesland_name) +
		(x.wahlkreis_id || x.wahlkreis_name) +
		(x.kreis_name || x.kreis_id || "") +
		(x.gemeinde_name || x.gemeinde_id || "") +
		(x.ortsteil_name || x.ortsteil_id || "") +
		((x.wahlbezirk_id || "") + (x.wahlbezirk_name || ""))
	);
}

export function saveResults(results: ResultType[], filter_bundesland?: string) {
	let wahlbezirke = require("./data/wahlbezirkeList.json") as ResultType[];
	if (filter_bundesland) {
		wahlbezirke = wahlbezirke.filter((x) => x.bundesland_id !== filter_bundesland);
	}

	const indexes = new Map(wahlbezirke.map((x, i) => [getIdFromResult(x), i]));

	results.forEach((x, i) => {
		const id = getIdFromResult(x);
		const index = indexes.get(id);

		if (index === undefined) {
			wahlbezirke.push(x);
			indexes.set(id, wahlbezirke.length - 1);
		} else {
			const exists = wahlbezirke[index];
			if (exists.anzahl_wähler !== x.anzahl_wähler) {
				console.error("Different wähler", x, exists);
				// throw new Error("Different wähler");
			}

			wahlbezirke[index] = x;
		}
	});

	wahlbezirke = wahlbezirke.filter((x) => x.wahlbezirk_name !== null || x.wahlbezirk_id !== null);

	console.log(wahlbezirke.length, results.length);

	fs.writeFileSync(__dirname + "/data/wahlbezirkeList.json", JSON.stringify(wahlbezirke, null, "\t"));
}
