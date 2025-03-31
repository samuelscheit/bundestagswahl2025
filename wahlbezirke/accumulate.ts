import fs from "fs";
import { defaultResult, ResultType } from "../wahlkreise/scrape";
// import list from "./data/wahlbezirkeList.json";
const list = require("./data/wahlbezirkeList.json") as ResultType[];

type Bundesland = string;
type Region = string;
type Kreis = string;
type Verband = string;
type Gemeinde = string;
type Wahlbezirk = string;

type ResultOrSubResult<Key extends string, T> = {
	[key in Exclude<Key, "result">]: T;
} & {
	result: ResultType;
};

export const wahlergebnis = {
	result: cleanDefaultResult(),
} as ResultOrSubResult<
	Bundesland,
	ResultOrSubResult<
		Region,
		ResultOrSubResult<
			Kreis,
			ResultOrSubResult<Verband, ResultOrSubResult<Gemeinde, ResultOrSubResult<Wahlbezirk, { result: ResultType }>>>
		>
	>
>;

export type Wahlergebnis = typeof wahlergebnis;

function addResult(a: ResultType, b: ResultType) {
	a.anzahl_berechtigte += b.anzahl_berechtigte;
	a.anzahl_wähler += b.anzahl_wähler;

	a.erststimmen.gültig += b.erststimmen.gültig;
	a.erststimmen.ungültig += b.erststimmen.ungültig;

	Object.keys(b.erststimmen.parteien).forEach((key) => {
		let previous = a.erststimmen.parteien[key] || 0;
		a.erststimmen.parteien[key] = previous + b.erststimmen.parteien[key] || 0;
	});

	a.zweitstimmen.gültig += b.zweitstimmen.gültig;
	a.zweitstimmen.ungültig += b.zweitstimmen.ungültig;

	Object.keys(b.zweitstimmen.parteien).forEach((key) => {
		let previous = a.zweitstimmen.parteien[key] || 0;
		a.zweitstimmen.parteien[key] = previous + b.zweitstimmen.parteien[key] || 0;
	});
}

function cleanDefaultResult() {
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
	} as ResultType;
}

list.forEach((item) => {
	item.bundesland_id ||= "null";
	item.region_id ||= "null";
	item.kreis_id ||= "null";
	item.verband_id ||= "null";
	item.gemeinde_id ||= "null";
	item.wahlbezirk_id ||= "null";

	addResult(wahlergebnis.result, item);

	let bundesland = wahlergebnis[item.bundesland_id];
	if (!bundesland) {
		bundesland = { result: cleanDefaultResult() } as any;
		bundesland.result.bundesland_id = item.bundesland_id;
		bundesland.result.bundesland_name = item.bundesland_name;

		wahlergebnis[item.bundesland_id] = bundesland;
	}
	addResult(bundesland.result, item);

	let region = bundesland[item.region_id];
	if (!region) {
		const result = cleanDefaultResult();
		result.bundesland_id = item.bundesland_id;
		result.bundesland_name = item.bundesland_name;
		result.region_id = item.region_id;

		region = { result } as any;
		bundesland[item.region_id] = region;
	}

	let kreis = region[item.kreis_id];
	if (!kreis) {
		const result = cleanDefaultResult();
		result.bundesland_id = item.bundesland_id;
		result.bundesland_name = item.bundesland_name;
		result.kreis_id = item.kreis_id;
		result.kreis_name = item.kreis_name;

		kreis = { result } as any;
		region[item.kreis_id] = kreis;
	}
	addResult(kreis.result, item);

	let verband = kreis[item.verband_id];
	let verband0 = kreis["0"];
	if (!verband0) {
		const result = cleanDefaultResult();
		result.bundesland_id = item.bundesland_id;
		result.bundesland_name = item.bundesland_name;
		result.kreis_id = item.kreis_id;
		result.kreis_name = item.kreis_name;

		verband0 = { result } as any;
		kreis["0"] = verband0;
	}
	if (!verband) {
		const result = cleanDefaultResult();
		result.bundesland_id = item.bundesland_id;
		result.bundesland_name = item.bundesland_name;
		result.kreis_id = item.kreis_id;
		result.kreis_name = item.kreis_name;
		result.verband_id = item.verband_id;
		result.verband_name = item.verband_name;

		verband = { result } as any;
		kreis[item.verband_id] = verband;
	}
	addResult(verband.result, item);
	addResult(verband0.result, item);

	let gemeinde = verband[item.gemeinde_id];
	if (!gemeinde) {
		const result = cleanDefaultResult();
		result.bundesland_id = item.bundesland_id;
		result.bundesland_name = item.bundesland_name;
		result.kreis_id = item.kreis_id;
		result.kreis_name = item.kreis_name;
		result.verband_id = item.verband_id;
		result.verband_name = item.verband_name;
		result.gemeinde_id = item.gemeinde_id;
		result.gemeinde_name = item.gemeinde_name;

		gemeinde = { result } as any;
		verband[item.gemeinde_id] = gemeinde;
		verband0[item.gemeinde_id] = gemeinde;
	}
	addResult(gemeinde.result, item);

	let bezirk = gemeinde[item.wahlbezirk_id];
	if (!bezirk) {
		const result = cleanDefaultResult();
		result.bundesland_id = item.bundesland_id;
		result.bundesland_name = item.bundesland_name;
		result.kreis_id = item.kreis_id;
		result.kreis_name = item.kreis_name;
		result.verband_id = item.verband_id;
		result.verband_name = item.verband_name;
		result.gemeinde_id = item.gemeinde_id;
		result.gemeinde_name = item.gemeinde_name;
		result.wahlbezirk_name = item.wahlbezirk_name;
		result.wahlbezirk_id = item.wahlbezirk_id;

		bezirk = { result } as any;
		gemeinde[item.wahlbezirk_id] = bezirk;
	}
	addResult(bezirk.result, item);

	bezirk.result = item;
});

if (!__dirname.includes("[")) {
	// do not run in nextjs server

	try {
		fs.writeFileSync(__dirname + "/data/wahlergebnis.json", JSON.stringify(wahlergebnis, null, "\t"), "utf-8");
	} catch (error) {}
}
