import axios from "axios";
import { axiosWithRedirect, overwriteCache } from "../wahlbezirke/axios.ts";
import { parse } from "node-html-parser";
import { download, ResultType } from "../wahlkreise/scrape.ts";
import { writeFileSync } from "fs";
import { getGemeindeByID } from "../wahlbezirke/gemeinden.ts";
import { CacheRequestConfig, NotEmptyStorageValue } from "axios-cache-interceptor";

async function main() {
	overwriteCache((key: string, value: NotEmptyStorageValue, currentRequest?: CacheRequestConfig) => {
		if (currentRequest?.url?.includes(".csv")) return false;
		if (currentRequest?.url?.includes("/uebersicht_") && currentRequest.url.endsWith(".json")) return false;
		if (currentRequest?.url?.includes("/ergebnis_") && currentRequest.url.endsWith(".json")) return false;
		return true;
	});

	const html = await axiosWithRedirect("https://www.wahlergebnisse.nrw/kommunalwahlen/2025/index_bm.shtml");
	const root = parse(html.data);

	const gemeinden =
		root
			.getElementById("demoFour")
			?.querySelectorAll("a")
			.map((a) => ({
				name: a.text.trim(),
				url: a.getAttribute("href")?.trim(),
			})) || [];

	const additional = [
		`https://wep.itk-rheinland.de/vm/prod/kw_2025/05111000/praesentation/index.html`, // düsseldorf
		`https://wahlergebnis.duisburg.de/KOM_2025/05112000/praesentation/index.html`, // duisburg
		`https://webapps-extern.essen.de/wahlergebnisse/KW2025/05113000/praesentation/index.html`, // essen
		`https://wep.itk-rheinland.de/vm/prod/kw_2025/05116000/praesentation/index.html`, // mönchengladbach
		`https://wahlpraesentation.muelheim-ruhr.de/kw25/05117000/praesentation/index.html`, // mühlheim
		`https://wahlen.regioit.de/2/km2025/05119000/praesentation/index.html`, // oberhausen
		`https://wahlen.remscheid.de/3/km2025/05120000/praesentation/index.html`, // remscheid
		`https://wahlen.stadt-koeln.de/prod/KW2025/05315000/praesentation/index.html`, // köln
		`https://wahlen.wuppertal.de/kw2025/05124000/praesentation/index.html`, // wuppertal
		`https://wahlen.regioit.de/1/km2025/05334000/praesentation/index.html`, // aachen
		`https://wahlen.regioit.de/3/km2025/05911000/praesentation/index.html`, // bochum
		`https://wahlen.digistadtdo.de/wahlergebnisse/Kommunalwahlen2025/05913000/praesentation/index.html`, // dortmund
		`https://wahlergebnisse.stadt-hagen.de/prod/KW2025/05914000/praesentation/index.html`, // hagen
		"https://wahl.leverkusen.de/vote/Kommunalwahl%202025-09-14/05316000/praesentation/index.html", // leverkusen
		"https://wahl.gelsenkirchen.de/votemanager/20250831/05513000/praesentation/index.html", // gelsenkirchen
		"https://wahlen.citeq.de/20250914/05515000/praesentation/index.html", // münster
		"https://wahlen.citeq.de/20250914/05915000/praesentation/index.html", // hamm
		"https://wahl.krzn.de/kw2025/wep960/", // herne
		"https://wahlen.regioit.de/2/km2025/05711000/praesentation/index.html", // bielefeld
		"https://wahlen.bonn.de/wahlen/KW2025/05314000/praesentation/index.html", // bonn
		"https://wahl.krzn.de/kw2025/wep250/", // schwalmtal

	];

	for (const a of additional) {
		gemeinden.push({
			name: "",
			url: a,
		});
	}

	// gemeinden.push({
	// 	name: "test",
	// 	url: "https://wahlen.kdvz.nrw/production/bw2025/05974008/praesentation/index.html",
	// });

	console.dir(gemeinden, { depth: null, maxArrayLength: Infinity });

	// const result = (await Promise.all(
	// 	gemeinden.slice(0, 1)
	// 	.filter(x=>!x.url?.includes("citeq.de")).map((gemeinde) =>

	// 		download({
	// 			id: "",
	// 			url: gemeinde.url || "",
	// 		})
	// 	)
	// )) as unknown as Partial<ResultType>[];

	let result = [] as Partial<ResultType>[];

	for (const gemeinde of gemeinden) {
		// if (gemeinde.url?.includes("citeq.de")) continue;
		// if (gemeinde.url?.includes("krzn.de")) continue;
		console.log("Downloading", gemeinde.name, gemeinde.url);

		try {
			const x = await download({
				id: "",
				url: gemeinde.url || "",
			});

			result.push(x);
		} catch (error) {
			console.error(error, gemeinde);
			continue;
		}
	}

	console.log("Downloaded", result.length);

	const gemeindenAggregiert: Record<
		string,
		ResultType & {
			ausgezählt: number;
			stimmbezirke: number;
			leading_party?: string;
		}
	> = {};

	result
		.flat()
		// .filter((x) => x !== undefined)
		.map((r, i) => {
			if (r.wahlart !== "Gemeinderatswahl") return

			const gemeinde_id = `${r.bundesland_id?.padStart(2, "0")}${r.region_id}${r.kreis_id?.padStart(2, "0")}${r.gemeinde_id ? r.gemeinde_id.padStart(3, "0") : r.verband_id?.padStart(4, "0")}`;

			delete r.bundesland_id;
			delete r.bundesland_name;
			delete r.zweitstimmen;
			delete r.gemeinde_id;
			delete r.gemeinde_name;
			delete r.kreis_id;
			delete r.kreis_name;
			delete r.ortsteil_id;
			delete r.ortsteil_name;
			delete r.wahlkreis_id;
			delete r.wahlkreis_name;
			delete r.verband_id;
			delete r.verband_name;
			delete r.region_id;
			delete r.region_name;
			// @ts-ignore
			delete r.wahleintrag;

			if (!r.wahlbezirk_adresse) {
				delete r.wahlbezirk_adresse;
			}
			if (!r.wahlbezirk_raum) {
				delete r.wahlbezirk_raum;
			}
			if (!r.briefwahl) {
				delete r.briefwahl;
			}

			r.gemeinde_id = gemeinde_id;

			const agg = (gemeindenAggregiert[gemeinde_id] = gemeindenAggregiert[gemeinde_id] || {
				anzahl_berechtigte: 0,
				anzahl_wähler: 0,
				erststimmen: {
					gültig: 0,
					ungültig: 0,
					parteien: {},
				},
				zweitstimmen: {
					gültig: 0,
					ungültig: 0,
					parteien: {},
				},
				ausgezählt: 0,
				stimmbezirke: 0,
			});

			agg.stimmbezirke++;
			if (!r.erststimmen || r.anzahl_wähler === 0) {
				return;
			}

			agg.anzahl_berechtigte += r.anzahl_berechtigte || 0;
			agg.anzahl_wähler += r.anzahl_wähler || 0;
			agg.erststimmen.gültig += r.erststimmen?.gültig || 0;
			agg.erststimmen.ungültig += r.erststimmen?.ungültig || 0;
			agg.zweitstimmen.gültig += r.erststimmen?.gültig || 0;
			agg.zweitstimmen.ungültig += r.erststimmen?.ungültig || 0;
			agg.ausgezählt++;

			for (const k of Object.keys(r.erststimmen?.parteien || {})) {
				agg.erststimmen.parteien[k] = (agg.erststimmen.parteien[k] || 0) + (r.erststimmen?.parteien[k] || 0);
			}

			for (const k of Object.keys(r.erststimmen?.parteien || {})) {
				let key = "";

				const keyLower = k.toLowerCase();

				if (keyLower.includes("cdu")) key = "CDU";
				else if (keyLower.includes("spd")) key = "SPD";
				else if (keyLower.includes("grüne")) key = "GRÜNE";
				else if (keyLower.includes("fdp")) key = "FDP";
				else if (keyLower.includes("linke")) key = "LINKE";
				else if (keyLower.includes("afd")) key = "AfD";
				else if (keyLower.includes("freie wähler")) key = "Freie Wähler";
				else if (keyLower.includes("die partei")) key = "DIE PARTEI";
				else if (keyLower.includes("fba")) key = "FBA";
				else if (keyLower.includes("bsw")) key = "BSW";
				else if (keyLower.includes("volt")) key = "VOLT";
				else key = k;

				agg.zweitstimmen.parteien[key] = (agg.zweitstimmen.parteien[key] || 0) + (r.erststimmen?.parteien[k] || 0);
			}
		});

	Object.values(gemeindenAggregiert).forEach((g) => {
		const gewonnen = Object.entries(g.zweitstimmen.parteien).sort(([_, a], [__, b]) => a - b);
		if (!gewonnen.length) return;
		g.leading_party = gewonnen[gewonnen.length - 1][0];
	});

	writeFileSync(__dirname + "/result.json", JSON.stringify(gemeindenAggregiert, null, 2));
}

while (true) {
	try {
		await main();
	} catch (error) {
		console.error(error);
	}
}
// for (const gemeinde of gemeinden) {

// 	await download({
// 		id: "",
// 		url: gemeinde.url || "",
// 	})
// }

// console.dir(result, { depth: null, maxArrayLength: null });
