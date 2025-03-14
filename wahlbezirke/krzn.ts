import parse from "node-html-parser";
import { wahlkreiseQuellen } from "../wahlkreise/wahlkreise";
import { axiosWithRedirect } from "./axios";
import { behoerden_queue, gemeinde_queue, saveResults } from "./wahlbezirke";
import { krznGetWahlbezirkeUrl, krznParseCSV, krznWahlkreis, type ResultType } from "../wahlkreise/scrape";
import fs from "fs";

const results: ResultType[] = [];

Object.entries(wahlkreiseQuellen).forEach(([wahlkreisId, quelle]) => {
	if (!quelle.includes("wahl.krzn.de")) return;

	behoerden_queue.add(async () => {
		var { data: html } = await axiosWithRedirect(quelle);

		const root = parse(html);

		const link = root.querySelector(`[title="Externe Links Kommunen anzeigen"]`);
		if (!link) throw new Error("external links not found: " + quelle);

		const href = link.getAttribute("href");
		if (!href) throw new Error("href not found: " + quelle);

		const url = new URL(href, quelle);

		var { data: html } = await axiosWithRedirect(url.href);

		const navigation = parse(html);

		navigation.querySelectorAll(`.ym-content-section-content table tbody tr td a`).map((link) => {
			const href = link.getAttribute("href");
			if (!href) return;

			const gemeindeUrl = new URL(href, url.href).href;

			gemeinde_queue.add(fetchGemeinde.bind(null, wahlkreisId, gemeindeUrl));
		});
	});
});

async function fetchGemeinde(wahlkreisId: string, url: string) {
	console.log("fetchGemeinde", wahlkreisId, url);

	const { data: html } = await axiosWithRedirect<string>(url);

	const downloadUrl = await krznGetWahlbezirkeUrl({ text: html, url, id: wahlkreisId });
	const { data } = await axiosWithRedirect<string>(downloadUrl, { responseType: "text" });

	const res = await krznParseCSV(data);

	res.forEach((wahlbezirk) => {
		wahlbezirk.wahlkreis_id = wahlkreisId;

		results.push(wahlbezirk);
	});
}

await behoerden_queue.onIdle();
await gemeinde_queue.onIdle();

saveResults(results);
