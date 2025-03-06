// @ts-ignore
import extractUrls from "extract-urls";
import PQueue from "p-queue";
import { parse } from "node-html-parser";
import { axios, cycleFetch } from "./axios";
import type { AxiosRequestConfig, AxiosResponse } from "axios";
import { WAS, votemanagerWithOptions, type ResultType } from "./scrape";
import { wahlkreiseQuellen } from "./wahlkreise";

const concurrency = 10;

const bundesland_queue = new PQueue({ concurrency });
const behoerden_queue = new PQueue({ concurrency });
const gemeinde_queue = new PQueue({ concurrency });
const verbund_queue = new PQueue({ concurrency });
const wahleintrage_queue = new PQueue({ concurrency });
const wahlbezirke_queue = new PQueue({ concurrency });

export type Context = {
	url: string;
	name: string;
	html?: string;
	bundesland: string;
	tries?: number;
};

export interface Wahleintrag {
	wahl: {
		id: number;
		titel: string;
	};
	stimmentyp: {
		id: number;
		titel: string;
	};
	gebiet_link: {
		id: string;
		type: string;
		title: string;
	};
}

export interface WahlDetails {
	titel: string;
	datum: string;
	ergebnisstatus: any[];
	stimmentypen: {
		id: number;
		titel: string;
	}[];
	behoerden_links: {
		url: string;
		titel: string;
	}[];
	menu_links: {
		id: string;
		type: string;
		title: string;
	}[];
	geografik_ebenen: any[];
	hasHochrechnung: boolean;
	file_version: string;
	file_timestamp: string;
	server_hash: string;
}

export interface EbenenÜbersicht {
	zeitstempel: string;
	seitentitel: string;
	tabelle: {
		header: {
			labelKurz: string;
			labelLang?: string;
		}[];
		headerAbs: {
			labelKurz: string;
			labelLang?: string;
		}[];
		zeilen: {
			order_value: number;
			label: string;
			link: {
				id: string;
				type: string;
				title: string;
			};
			externeUrl: boolean;
			statusString: string;
			statusProzent: number;
			stimmbezirk: boolean;
			highlighted: boolean;
			felder: {
				order_value_abs: string;
				order_value_proz: string;
				absolut: string;
				prozent: string;
				tip: string;
				highlighted: boolean;
			}[];
		}[];
	};
	has_geografik: boolean;
	file_version: string;
	file_timestamp: string;
	server_hash: string;
}

export async function axiosWithRedirect<T = any, D = any>(
	url: string,
	opts: AxiosRequestConfig & { tries?: number } = {}
): Promise<AxiosResponse<T, D> & { cached?: boolean; url: string }> {
	if (opts.tries && opts.tries > 5) throw new Error("Too many tries: " + url);
	opts.tries = (opts.tries || 0) + 1;

	try {
		if (url.includes("wahlen-muenchen.de")) return await cycleFetch(url, opts);

		var response = await axios(url, opts);
	} catch (error) {
		console.error("Request failed, retrying ...", url, (error as Error).message);
		return axiosWithRedirect(url, opts);
	}

	if (response.data?.includes?.(`http-equiv="refresh" `)) {
		const root = parse(response.data);
		const meta = root.querySelector("meta[http-equiv='refresh']");
		const content = meta?.getAttribute("content");
		const [_, newUrl] = content?.split("=") || [];
		if (newUrl) {
			console.log("Refresh", newUrl);
			return axiosWithRedirect(newUrl, opts);
		}
	} else if (response.headers["location"]) {
		const newUrl = response.headers["location"];
		console.log("Redirect", url, newUrl);

		return axiosWithRedirect(newUrl, opts);
	}

	return { ...response, url };
}

export async function getWahlbezirkVotemanager(opts: Context) {
	var { url, name, html } = opts as Required<Context>;
	// termine https://votemanager-da.ekom21cdn.de/06431001/index.html
	// termin übersicht https://wahl.gelsenkirchen.de/votemanager/20250223/05513000/praesentation/index.html
	// ergebnis https://votemanager-da.ekom21cdn.de/2025-02-23/06431001/praesentation/ergebnis.html?wahl_id=728&stimmentyp=0&id=ebene_-575_id_638

	if (!html.includes("termine.json")) {
		// all irrelevant because the used votemanager version is older than BTW2025
		throw new Error("Keine BTW25 Ergebnisse (alte version)");
	}

	let base = url.replace("/index.html", "");
	if (base.endsWith("/")) base = base.slice(0, -1);

	const termineUrl = base + "/api/termine.json";

	const { data } = await axiosWithRedirect(termineUrl);
	const { termine } = data;

	if (!termine) throw new Error("INVALID RESPONSE: " + termineUrl + " " + opts.url);

	const btw25 = termine.find((x: any) => x.date === "23.02.2025");
	if (!btw25) throw new Error("Keine BTW25 Ergebnisse (Kein Termin)");

	// https://votemanager.kdo.de/15084590/../2025022302/15084590/praesentation/
	// https://votemanager.kdo.de/15084590/../2025022302/15084590/daten/api/termin.json
	const apiType = html.includes("../api") ? `/api/praesentation` : `/daten/api`;
	const apiEndpoint = base + "/" + btw25.url.replace("/praesentation/", apiType);
	const terminUrl = apiEndpoint + "/termin.json";

	const { data: termin } = await axiosWithRedirect<{ wahleintraege: Wahleintrag[] }>(terminUrl);
	let { wahleintraege } = termin;

	if (!wahleintraege) throw new Error("INVALID RESPONSE: " + opts.url + " " + terminUrl);

	wahleintraege = wahleintraege.filter((x) => x.stimmentyp.id === 1 && x.wahl.titel.toLowerCase().includes("bundestag"));
	if (wahleintraege.length <= 0) throw new Error("Keine BTW25 Ergebnisse (Kein Wahleintrag)");

	// https://votemanager.kdo.de/2025022302/15084590/daten/api/termin.json

	// console.log(name, terminUrl);
	// console.log(name, base + "/" + btw25.url);

	let result = {} as Record<string, Record<string, ResultType>>;

	await wahleintrage_queue.addAll(
		wahleintraege.map((wahleintrag) => async () => {
			try {
				// https://wahlen.digistadtdo.de/wahlergebnisse/Bundestagswahl2025/05913000/daten/api/wahl_35/wahl.json?ts=1741130017532

				const wahlUrl = `${apiEndpoint}/wahl_${wahleintrag.wahl.id}/wahl.json`;

				const { data: wahl } = await axiosWithRedirect<WahlDetails>(wahlUrl);

				const ebene = wahl.menu_links.find((x) => x.id === "ebene_6");

				if (!ebene) {
					// ist ergebnisseite vom wahlkreis, nicht von einzelnen gemeinden
					throw new Error("Keine BTW25 Ergebnisse (Keine Wahlbezirke)");
				}

				const { data: wahlbezirke } = await axiosWithRedirect<EbenenÜbersicht>(
					`${apiEndpoint}/wahl_${wahleintrag.wahl.id}/uebersicht_${ebene.id}_1.json`
				);

				if (!wahlbezirke.tabelle) throw new Error("Keine BTW25 Ergebnisse (Keine Wahlbezirke)");

				const wahlbezirke_result = {} as Record<string, ResultType>;

				await wahlbezirke_queue.addAll(
					wahlbezirke.tabelle.zeilen
						.filter((x) => !x.externeUrl && x.link?.id?.includes("ebene_6"))
						.map((x) => async () => {
							var url = base + "/" + btw25.url;
							try {
								url =
									base +
									"/" +
									btw25.url +
									`ergebnis.html?wahl_id=${wahleintrag.wahl.id}&stimmentyp=${wahleintrag.stimmentyp.id}&id=${x.link.id}`;

								const wahlbezirk_result = await votemanagerWithOptions({
									ebene_id: x.link.id,
									wahl_id: `${wahleintrag.wahl.id}`,
									url: apiEndpoint,
								});

								wahlbezirke_result[x.label] = wahlbezirk_result;

								// console.log(url, x.label, result);
								return wahlbezirk_result;
							} catch (error) {
								if ((error as Error).message.includes("Keine Daten")) return;
								console.error("Error", x.label, url, (error as Error).message);

								// throw new Error("Error " + x.label + " " + url + " " + JSON.stringify(x) + " " + (error as Error).message);
							}
						})
				);

				let title = wahleintrag.gebiet_link.title;
				if (title === "Gesamtergebnis") title = data.title;

				result[title] = wahlbezirke_result;
			} catch (error) {
				console.error("Error", name, (error as Error).message);
			}
		})
	);

	return result;
}

export async function getWahlbezirk(opts: Context) {
	if (opts.tries && opts.tries > 5) throw new Error("Too many tries");
	opts.tries = (opts.tries || 0) + 1;

	var { data: html, status, cached, url } = await axiosWithRedirect(opts.url, { responseType: "text" });

	if (!cached) console.log("not cached", opts.url);
	if (status >= 400) throw new Error(`Request failed with status code ${status}`);

	const isVoteManager = html.includes("votemanager.de") || html.includes("termine.json") || html.includes("vue_index_container");

	if (!isVoteManager) {
		// console.log(url, name);

		return;
	}

	// console.log(isVoteManager, url);
	return getWahlbezirkVotemanager({ ...opts, url, html });
}

export async function getWahlbezirkeVotemanager() {
	const {
		data: { data },
	} = await axiosWithRedirect("https://wahlen.votemanager.de/behoerden.json", { responseType: "json" });

	const result = {} as Record<string, Record<string, ResultType>>;

	await Promise.all(
		data.map((x: string[]) => {
			const [link, name, bundesland] = x;

			let [url] = extractUrls(link) as string[];

			return behoerden_queue.add(async () => {
				try {
					const bezirk_result = await getWahlbezirk({
						url,
						name,
						bundesland,
					});

					Object.assign(result, bezirk_result);
				} catch (error) {
					const msg = (error as Error).message || "";
					if (msg.includes("Keine BTW25") || msg.includes("Request failed") || msg.includes("Unable to connect")) {
						return;
					}

					console.error("Error", url, name, msg);

					// throw url + " " + name + " " + msg;
				}
			});
		})
	);

	await behoerden_queue.onIdle();
	return result;
}

const queues = [behoerden_queue, bundesland_queue, wahleintrage_queue, gemeinde_queue, verbund_queue, wahlbezirke_queue];

export async function getUntergebieteVoteElect(url: string, depth = 0) {
	var { data: html, status, url } = await axiosWithRedirect(url, { responseType: "text" });

	if (status >= 400) throw new Error(`Request failed with status code ${status}`);

	const isVoteElectIT = html.includes("jigsaw");
	if (!isVoteElectIT) throw new Error("Not a VoteElect IT page");

	const root = parse(html);
	const gebiete = root.querySelectorAll(".gebietwaehler .dropdown__content .linklist:not(.header-gebiet__obergebiete) a");
	let base = !url.endsWith("/") ? url.split("/").slice(0, -1).join("/") : url;
	base += "/";

	const gebietName = root.querySelector(".header-gebiet__name")!.structuredText;

	console.log(gebietName, url);

	if (gebiete.length !== 0) {
		const results = {} as Record<string, ResultType>;

		const queue = queues[depth];
		if (!queue) throw new Error("Queue not found: " + depth + " " + url);

		await queue.addAll(
			gebiete.map((x) => async () => {
				var unterurl = url;
				try {
					unterurl = base + x.getAttribute("href");

					const result = await getUntergebieteVoteElect(unterurl, depth + 1);

					Object.assign(results, result);
				} catch (error) {
					console.error("Error", unterurl, (error as Error).message);
				}
			})
		);

		return {
			[gebietName]: results,
		};
	}
	// unterste ebene => Wahlbezirke

	return {
		[gebietName]: WAS({
			id: "",
			text: "",
			root,
			url,
		}),
	};
}

export async function getWahlbezirkeVoteElect() {
	const results = {} as Record<string, Record<string, ResultType>>;

	await behoerden_queue.addAll(
		Object.values(wahlkreiseQuellen).map((x) => async () => {
			try {
				const result = await getUntergebieteVoteElect(x, 1);

				Object.assign(results, result);
			} catch (error) {
				const msg = (error as Error).message || "";
				if (msg.includes("Not a VoteElect IT page") || msg.includes("Request failed") || msg.includes("Unable to connect")) {
					return;
				}
				console.error("Error", x, msg);
			}
		})
	);

	await behoerden_queue.onIdle();
	await gemeinde_queue.onIdle();
	await wahleintrage_queue.onIdle();
	await wahlbezirke_queue.onIdle();

	return results;
}
