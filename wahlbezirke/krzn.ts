import parse from "node-html-parser";
import { wahlkreiseQuellen } from "../wahlkreise/wahlkreise";
import { axiosWithRedirect } from "./axios";
import { behoerden_queue, gemeinde_queue, saveResults } from "./wahlbezirke";
import { krznGetWahlbezirkeUrl, krznParseCSV, krznWahlkreis, type ResultType } from "../wahlkreise/scrape";
import { getGemeinde } from "./gemeinden";
const krefeldMapping = require("./krefeld/mapping.json") as Record<string, string>;

const results: ResultType[] = [];

Object.entries(wahlkreiseQuellen).forEach(([wahlkreisId, quelle]) => {
	if (!quelle.includes("wahl.krzn.de")) return;
	if (quelle !== "https://wahl.krzn.de/bw2025/wep200/erg/200-305-BW-BW-d110-1.html") return;

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

	const gemeindeName = res[0].gemeinde_name;
	if (gemeindeName) {
		const gemeinde = getGemeinde(gemeindeName);
		// wahlkreisId = gemeinde.wahlkreis_id!;
	}

	res.forEach((wahlbezirk) => {
		if (wahlbezirk.gemeinde_name === "Stadt Krefeld") {
			wahlbezirk.wahlkreis_id = krefeldMapping[wahlbezirk.wahlbezirk_id!];
		} else {
			wahlbezirk.wahlkreis_id = wahlkreisId;
		}

		results.push(wahlbezirk);
	});
}

await behoerden_queue.onIdle();
await gemeinde_queue.onIdle();

saveResults(results);
