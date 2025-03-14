import { getBundeswahlleiterDaten } from "../bundeswahlleiter/read";
import _Wahlkreise from "./data/out.json";
import type { defaultResult } from "./scrape";
import { wahlkreiseNamen, wahlkreiseQuellen } from "./wahlkreise";
import fs from "fs";

const Wahlkreise = _Wahlkreise as any as Record<string, ReturnType<typeof defaultResult>>;

const Bundeswahlleiter = getBundeswahlleiterDaten("gesamtergebnis_01.xml");

let result = [] as {
	wahlkreis_id: string;
	wahlkreis_source: string;
	bundesland_id: string;
	wahlkreis: string;
	partei: string;
	wahlkreisStimmen: number;
	bundesStimmen: number;
	diff: number;
	absdiff: number;
}[];

const totalBezirk = {} as Record<string, number>;

const totalPartei = {} as Record<string, number>;
const totalParteiAbs = {} as Record<string, number>;

Object.keys(Wahlkreise).forEach((id) => {
	const wahlkreisName = wahlkreiseNamen[id];
	const wahlkreis = Wahlkreise[id];
	const bundesergebnis = Bundeswahlleiter[id];

	Object.keys(wahlkreis.zweitstimmen.parteien).forEach((partei) => {
		const kreisPartei = wahlkreis.zweitstimmen.parteien[partei] || 0;
		const bundPartei = bundesergebnis.zweitstimmen.parteien[partei] || 0;

		if (kreisPartei !== bundPartei) {
			const diff = kreisPartei - bundPartei;
			const absdiff = Math.abs(diff);
			totalParteiAbs[partei] = (totalParteiAbs[partei] || 0) + absdiff;
			totalPartei[partei] = (totalPartei[partei] || 0) + diff;

			totalBezirk[wahlkreisName] = (totalBezirk[wahlkreisName] || 0) + absdiff;

			result.push({
				wahlkreis: wahlkreisName,
				partei,
				wahlkreisStimmen: kreisPartei,
				bundesStimmen: bundPartei,
				diff,
				absdiff,
				bundesland_id: wahlkreis.bundesland_id!,
				wahlkreis_id: id!,
				wahlkreis_source: wahlkreiseQuellen[id as any as keyof typeof wahlkreiseQuellen],
			});
		}
	});
});

result = result.sort((a, b) => {
	return totalBezirk[b.wahlkreis] - totalBezirk[a.wahlkreis];
});

console.table(
	result.map((x) => ({
		wahlkreis: x.wahlkreis,
		partei: x.partei,
		bundesStimmen: x.bundesStimmen,
		wahlkreisStimmen: x.wahlkreisStimmen,
		diff: x.diff,
		absdiff: x.absdiff,
	}))
);

Object.values(result).forEach((x) => {});

console.table(Object.fromEntries(Object.entries(totalPartei).sort((a, b) => a[1] - b[1])));
console.table(Object.fromEntries(Object.entries(totalParteiAbs).sort((a, b) => a[1] - b[1])));

console.log(Object.values(totalPartei).reduce((acc, x) => acc + x, 0));

fs.writeFileSync(__dirname + "/data/total.json", JSON.stringify(totalParteiAbs, null, 2));
fs.writeFileSync(__dirname + "/data/list.json", JSON.stringify(result, null, 2));
