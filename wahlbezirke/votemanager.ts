// @ts-ignore
import extractUrls from "extract-urls";
import { axiosWithRedirect } from "./axios";
import { defaultResult, getIdFromName, type Options, type ResultType } from "./scrape";
import { behoerden_queue, wahlbezirke_queue, wahleintrage_queue, type Context } from "./wahlbezirke";
import { cleanGemeindeName, gemeinden } from "./gemeinden";

export async function votemanager(options: Options & { text: string }) {
	const { searchParams, origin, pathname } = new URL(options.url);
	const wahl_id = searchParams.get("wahl_id")!;
	const id = searchParams.get("id")!;

	const baseUrl = origin + pathname.replace("/praesentation/ergebnis.html", "");
	const apiUrl = baseUrl + (options.text.includes("../api") ? "/api/praesentation" : "/daten/api");

	console.log({ baseUrl, apiUrl, url: options.url });

	return votemanagerWithOptions({ url: apiUrl, wahl_id, ebene_id: id });
}

export interface VotemanagerConfig {
	links: {
		titel: string;
		text: string;
		url: string;
	}[];
	behoerden_links: {
		header: {
			text: string;
			url: string;
		};
		links: {
			text: string;
			url: string;
		}[];
	};
	eigene_texte: {
		gesamtergebnis: {};
		behoerden_startseite: {};
	};
	umgebung: {};
	behoerde: string;
	activate_log: boolean;
	homepage: string;
	impressum_url: string;
	datenschutz_url: string;
	barrierefreiheit_url: string;
	alle_wahltermine_link: string;
	logo: {
		src: string;
		link: string;
		alternativtext: string;
	};
	zeige_uebersicht_strassen_link: boolean;
	zeige_uebersicht_wahlraeume_link: boolean;
	lizenz: boolean;
	file_version: string;
	file_timestamp: string;
	server_hash: string;
}

export async function votemanagerWithOptions({ ebene_id, url, wahl_id }: { url: string; wahl_id: string; ebene_id: string }) {
	const results = await Promise.all([
		axiosWithRedirect<WahlErgebnis>(`${url}/wahl_${wahl_id}/ergebnis_${ebene_id}_0.json`, { responseType: "json" }),
		axiosWithRedirect<WahlErgebnis>(`${url}/wahl_${wahl_id}/ergebnis_${ebene_id}_1.json`, { responseType: "json" }),
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

export async function getWahlbezirk(opts: Context) {
	if (opts.tries && opts.tries > 5) throw new Error("Too many tries");
	opts.tries = (opts.tries || 0) + 1;

	var { data: html, status, cached, url } = await axiosWithRedirect(opts.url, { responseType: "text" });

	if (status >= 400) throw new Error(`Request failed with status code ${status}`);

	const isVoteManager = html.includes("votemanager.de") || html.includes("termine.json") || html.includes("vue_index_container");

	if (!isVoteManager) return;

	return getWahlbezirkVotemanager({ ...opts, url, html });
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

	let results = [] as ResultType[];

	const { data: config } = await axiosWithRedirect<VotemanagerConfig>(`${apiEndpoint}/config.json`, { responseType: "json" });

	const gemeinde = gemeinden.get(cleanGemeindeName(config.behoerde));
	if (!gemeinde) {
		throw new Error("Keine BTW25 Ergebnisse (Keine Gemeinde)");
	}
	console.log(config.behoerde, gemeinde.gemeinde_name);

	await wahleintrage_queue.addAll(
		wahleintraege.map((wahleintrag) => async () => {
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

							wahlbezirk_result.bundesland_name = gemeinde.bundesland_name;
							wahlbezirk_result.bundesland_id = gemeinde.bundesland_id;

							wahlbezirk_result.wahlkreis_id = gemeinde.wahlkreis_id;
							wahlbezirk_result.wahlkreis_name = gemeinde.wahlkreis_name;

							wahlbezirk_result.kreis_id = gemeinde.kreis_id;
							wahlbezirk_result.kreis_name = gemeinde.kreis_name;

							wahlbezirk_result.gemeinde_id = gemeinde.gemeinde_id;
							wahlbezirk_result.gemeinde_name = gemeinde.gemeinde_name;

							wahlbezirk_result.wahlbezirk_name = x.label;
							wahlbezirk_result.wahlbezirk_id = getIdFromName(x.label);

							results.push(wahlbezirk_result);
						} catch (error) {
							if ((error as Error).message.includes("Keine Daten")) return;

							throw new Error("Error " + x.label + " " + url + " " + JSON.stringify(x) + " " + (error as Error).message);
						}
					})
			);

			let title = wahleintrag.gebiet_link.title;
			if (title === "Gesamtergebnis") title = data.title;
		})
	);

	return results;
}

export async function getWahlbezirkeVotemanager() {
	const {
		data: { data },
	} = await axiosWithRedirect("https://wahlen.votemanager.de/behoerden.json", { responseType: "json" });

	let results = [] as ResultType[];

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
					if (!bezirk_result) return;

					results = results.concat(bezirk_result);
				} catch (error) {
					const msg = (error as Error).message || "";
					if (
						msg.includes("404") ||
						msg.includes("Keine BTW25") ||
						url.includes("wahlen.rhoen-grabfeld.de") ||
						name === "Salzgitter" ||
						name === "Verwaltungsgemeinschaft Kirchehrenbach" ||
						name === "Veitshöchheim" ||
						name === "Kirchehrenbach" ||
						name === "Hebertshausen" ||
						name === "Bogen" ||
						name === "Höchberg" ||
						name === "Schiffweiler" ||
						name === "Veitshöchheim"
					) {
						return;
					}

					throw new Error(url + " " + name + " " + msg);
				}
			});
		})
	);

	await behoerden_queue.onIdle();
	return results;
}

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

export interface WahlErgebnis {
	zeitstempel: string;
	seitentitel: string;
	Komponente: {
		hinweis_auszaehlung?: string;
		tabelle: {
			zeilen: {
				color: string;
				label: {
					labelKurz: string;
				};
				zahl: string;
				prozent: string;
				tagged: boolean;
			}[];
		};
		info: {
			titel: string;
			hinweis: any[];
			tabelle: {
				zeilen: {
					label: {
						labelKurz: string;
					};
					zahl: string;
					prozent: string;
					tagged: boolean;
				}[];
			};
		};
		grafik: {
			title: {
				titel: string;
				subtitle: string;
			};
			balken: {
				bezeichnung: string;
				color: string;
				bezeichnungAusfuehrlich: string;
				wert: number;
				wertString: string;
				prozentGerundet: number;
				prozentString: string;
			}[];
			sonstige: {
				bezeichnung: string;
				color: string;
				wert: number;
				wertString: string;
				prozentGerundet: number;
				prozentString: string;
			};
			sonstigeBalken: {
				bezeichnung: string;
				color: string;
				bezeichnungAusfuehrlich: string;
				wert: number;
				wertString: string;
				prozentGerundet: number;
				prozentString: string;
			}[];
			footer: string;
			isBalkenDarstellung: boolean;
			file_version: string;
			file_timestamp: string;
			server_hash: string;
		};
		wahlbeteiligung: {
			text: {
				text: string;
				prozent: number;
			};
			hinweis: string;
		};
	};
	file_version: string;
	file_timestamp: string;
	server_hash: string;
}
