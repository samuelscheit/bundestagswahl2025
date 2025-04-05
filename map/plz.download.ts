import fs from "fs";
import PQueue from "p-queue";
import parse from "node-html-parser";
import { AxiosError } from "axios";
import rebrowserPuppeteer, { Browser } from "rebrowser-puppeteer-core";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { distance } from "fastest-levenshtein";
import { addExtra } from "puppeteer-extra";
import { getGemeinde, getGemeindeByID } from "../wahlbezirke/gemeinden";
import uniq from "lodash/uniq";
import { Postleitzahl, postleitzahlAgsMap, postleitzahlen, postleitzahlMap } from "./plz";

const puppeteer = addExtra(rebrowserPuppeteer as any) as any as typeof rebrowserPuppeteer;
// @ts-ignore
puppeteer.use(StealthPlugin());

const concurrency = 1;
const queue = new PQueue({ concurrency });

const browser: Browser = await puppeteer.launch({
	headless: true,
	executablePath: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
});

async function getPage() {
	const window = await browser.createBrowserContext();
	const page = await window.newPage();

	// block images
	page.setRequestInterception(true);
	page.on("request", (request) => {
		if (request.url().includes("/cdn-cgi/")) return request.continue();
		if (request.url().includes("cloudflare.com")) return request.continue();

		const type = request.resourceType();
		if (type === "image" || type === "media" || type === "font" || type === "stylesheet") {
			request.abort();
		} else {
			if (request.url().includes("/source/")) return request.abort();
			if (request.url().includes("googletagmanager.com")) return request.abort();

			console.log(request.url());
			request.continue();
		}
	});
	page.on("error", (error) => {
		console.error("Page error", error);
	});
	page.on("pageerror", (error) => {
		console.error("Page error", error);
	});

	return page;
}

const stadtstaaten = ["11", "4", "2", "HH", "BE", "HB"]; // Berlin, Hamburg, Bremen

const bundeslandShortCode = {
	SH: "1", // Schleswig-Holstein
	HH: "2", // Hamburg
	NI: "3", // Niedersachsen
	HB: "4", // Bremen
	NW: "5", // Nordrhein-Westfalen
	HE: "6", // Hessen
	RP: "7", // Rheinland-Pfalz
	BW: "8", // Baden-Württemberg
	BY: "9", // Bayern
	SL: "10", // Saarland
	BE: "11", // Berlin
	BB: "12", // Brandenburg
	MV: "13", // Mecklenburg-Vorpommern
	SN: "14", // Sachsen
	ST: "15", // Sachsen-Anhalt
	TH: "16", // Thüringen
};

let rateLimitPromise = Promise.resolve();

const pagePool = await Promise.all(
	[...Array(concurrency)].map(async () => {
		return await getPage();
	})
);
let pageIndex = 0;

async function fetchData(plz: string, ags: string) {
	const result = {} as Record<string, string[]>;
	const postleitzahl = {} as Postleitzahl;
	const possibleGemeinden = postleitzahlAgsMap.get(plz)!.map((ags) => getGemeindeByID(ags));
	const kreis = getGemeindeByID(ags);
	// const page = await getPage();

	const thisPageIndex = pageIndex;
	var page = pagePool[thisPageIndex];
	pageIndex = (thisPageIndex + 1) % pagePool.length;
	const url = `https://www.suche-postleitzahl.org/plz-gebiet/${plz}`;

	await rateLimitPromise;
	const response = await page.goto(url, {
		waitUntil: "domcontentloaded",
		// waitUntil: "networkidle0",
	});
	const status = response?.status();
	if (status === 429 || status === 403) {
		rateLimitPromise = new Promise<any>(async (resolve, reject) => {
			console.error("Rate limit exceeded");
			try {
				await page.screenshot({ path: __dirname + "/screenshot1.png" });
				const response = await page.waitForNavigation({ timeout: 2000, waitUntil: "networkidle0" });
				if (response && response?.status() < 400) {
					console.error("Rate limit lifted " + response?.status());
					return resolve(null);
				}
				await page.screenshot({ path: __dirname + "/screenshot2.png" });
				await page.close();
				page = await getPage();
				pagePool[thisPageIndex] = page;
			} catch (error) {}

			resolve(null);
		});
		await rateLimitPromise;

		return fetchData(plz, ags);
	} else if (status !== 200 && status !== 304) {
		throw new Error("Error fetching data: " + response?.status() + " " + response?.statusText() + " " + plz);
	}
	const html = await page.content();
	const root = parse(html);

	root.querySelectorAll("#info tbody tr").map((row) => {
		const header = row.querySelector("th")?.structuredText.trim();
		let values = row.querySelectorAll("li");
		if (!values.length) values = row.querySelectorAll("p");
		if (!values.length) values = row.querySelectorAll("strong");
		if (!values.length) values = row.querySelectorAll("td");

		const textValues = values.map((x) => x.structuredText.trim());

		result[header || ""] = textValues;
	});

	postleitzahl.bundesland_id = kreis.bundesland_id!;
	postleitzahl.region_id = kreis.region_id!;
	postleitzahl.kreis_id = kreis.kreis_id!;

	postleitzahl.postleitzahl = result["Postleitzahl"]?.[0] || plz;
	const gemeinden = [] as Postleitzahl["gemeinden"];
	postleitzahl.gemeinden = gemeinden;

	const ortsteile = result["Ortsteile"] || [];
	const gemeinde_name =
		result["Gemeinde"]?.[0] ||
		result["Markt"]?.[0] ||
		result["Flecken"]?.[0] ||
		result["Ort"]?.[0] ||
		result["Ostseebad"]?.[0] ||
		result["Nordseebad"]?.[0] ||
		result["Marktflecken"]?.[0] ||
		Object.entries(result).find(([key]) => key.toLowerCase().includes("stadt"))?.[1]?.[0];

	function addGemeindePlz(gemeinde_name: string, ortsteile: string[], bundesland_id?: string) {
		if (bundesland_id) bundesland_id = bundeslandShortCode[bundesland_id as keyof typeof bundeslandShortCode] || bundesland_id;

		const gemeinde_name_parts = uniq(gemeinde_name.split(" ").map((x) => x.split("/"))).flat();

		const sorted = possibleGemeinden
			.filter((x) => {
				if (!bundesland_id) return true;

				return x.bundesland_id === bundesland_id;
			})
			.map((gemeinde) => {
				const name = gemeinde.gemeinde_name || gemeinde.verband_name!;
				const parts = uniq(name.split(" ").map((x) => x.split("/")))
					.flat()
					.filter((x) => x.length > 1);

				const distances = parts
					.map((x) => {
						return gemeinde_name_parts.map((y) => distance(x, y));
					})
					.flat();
				distances.push(distance(name, gemeinde_name));

				return {
					...gemeinde,
					dist: Math.min(...distances),
				};
			})
			.sort((a, b) => a.dist - b.dist);

		const gemeinde = sorted[0];
		if (!gemeinde) {
			throw new Error("Gemeinde not found");
		}

		if (gemeinde.dist > 0 && sorted.length > 1) {
			console.log(
				gemeinde.dist,
				gemeinde.gemeinde_name || gemeinde.verband_name,
				"|",
				gemeinde_name,
				plz,
				"<|>",
				possibleGemeinden.map((x) => x.gemeinde_name || x.verband_name).join(" | ")
			);
		}

		if (stadtstaaten.includes(gemeinde.bundesland_id!) && ortsteile.length === 1 && (ortsteile[0] === "-" || ortsteile[0] === "alle")) {
			ortsteile = [gemeinde_name];
		}

		gemeinden.push({
			name: gemeinde.gemeinde_name || gemeinde.gemeinde_name || gemeinde_name,
			gemeinde_id: gemeinde.gemeinde_id || undefined,
			verband_id: gemeinde.verband_id || undefined,
			ortsteile,
		});
	}

	const headers = root.querySelectorAll("#list thead tr th").map((x) => x.structuredText.trim());
	let previous = {
		Ortsteile: [] as string[],
		Bundesland: undefined as undefined | string,
		Ort: undefined as undefined | string,
		Landkreis: undefined as undefined | string,
		Ortsteil: undefined as undefined | string,
	};

	const listRows = root.querySelectorAll("#list tbody tr");

	if (gemeinde_name && !listRows.length) addGemeindePlz(gemeinde_name, ortsteile);

	listRows.map((row) => {
		const rows = row.querySelectorAll("td");

		const rowResult = headers.reduce((acc, header, index) => {
			const value = rows[index]?.structuredText?.trim();
			if (value) {
				acc[header] = value;
			}
			return acc;
		}, {} as Record<string, string>);
		const result = { ...previous, ...rowResult };
		var { Ort, Ortsteil, Ortsteile, Landkreis, Bundesland } = result;

		if (!Ort) throw new Error("Missing Ortsname");

		if (previous?.Ort && Ort !== previous.Ort) {
			addGemeindePlz(previous.Ort, previous.Ortsteile, previous.Bundesland);
			Ortsteile = result.Ortsteile = [];
		}

		previous = result;

		if (!Ortsteil) return;
		if (Ortsteile.includes(Ortsteil)) return;
		Ortsteile.push(Ortsteil);
	});

	if (previous.Ort) addGemeindePlz(previous.Ort, previous.Ortsteile, previous.Bundesland);

	const Ortsteile = result["Ortsteile"]?.length ? result["Ortsteile"] : undefined;
	const Stadtteil = result["Stadtteil"]?.[0] || result["Bezirk"]?.[0];
	const Bundesland = result["Bundesland"]?.[0];

	if (!gemeinden.length && Stadtteil && Bundesland) {
		// console.log("Stadtteil", Stadtteil, Bundesland);
		const gemeinde = getGemeinde(Bundesland);
		if (!gemeinde.gemeinde_name) throw new Error("Missing Gemeinde name");
		if (!gemeinde.gemeinde_id) throw new Error("Missing Gemeinde ID");

		gemeinden.push({
			name: gemeinde.gemeinde_name,
			ortsteile: Ortsteile || [Stadtteil],
			gemeinde_id: gemeinde.gemeinde_id,
		});
	}

	if (!gemeinden.length) {
		throw new Error("Missing Gemeinde");
	}

	for (const key in postleitzahl) {
		if (postleitzahl[key as keyof Postleitzahl] === undefined) {
			delete postleitzahl[key as keyof Postleitzahl];
		}
	}

	return postleitzahl;
}

for (const { plz, ags } of postleitzahlen) {
	if (postleitzahlMap.has(plz)) continue;
	if (plz === "08301") continue; // doesnt exist anymore

	queue.add(async () => {
		await rateLimitPromise;

		try {
			const result = await fetchData(plz, ags);

			postleitzahlMap.set(result.postleitzahl, result);

			fs.writeFileSync(__dirname + "/data/postleitzahlListe.json", JSON.stringify([...postleitzahlMap.values()], null, "\t"));
		} catch (error) {
			console.error("Error", plz, error.message);
			if (error.message?.includes("net::")) {
				return;
			}
			if (error && error instanceof AxiosError) {
				console.log(error.response?.data);
			}

			process.exit();
			throw error.message;
		}
	});
}

await queue.onIdle();
await browser.close();

const result = [] as Postleitzahl[];

postleitzahlMap.forEach((postleitzahl) => {
	result.push(postleitzahl);
});

fs.writeFileSync(__dirname + "/data/postleitzahlListe.json", JSON.stringify(result, null, "\t"));
