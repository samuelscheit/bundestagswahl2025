import { Bundeswahlleiter } from "./bundeswahlleiter/read";
import _Wahlbezirke from "./wahlbezirke/data/out.json";
import type { defaultResult } from "./wahlbezirke/scrape";
import { wahlbezirkeNamen } from "./wahlbezirke/wahlbezirke";
import fs from "fs";

const Wahlbezirke = _Wahlbezirke as any as Record<string, ReturnType<typeof defaultResult>>;

Bundeswahlleiter;
Wahlbezirke;

let result = [] as {
	wahlbezirk: string;
	partei: string;
	wahlbezirkStimmen: number;
	bundesStimmen: number;
	diff: number;
}[];

const totalBezirk = {} as Record<string, number>;

const totalPartei = {} as Record<string, number>;

Object.keys(Wahlbezirke).forEach((id) => {
	const wahlbezirkName = wahlbezirkeNamen[id];
	const wahlbezirk = Wahlbezirke[id];
	const bundesergebnis = Bundeswahlleiter[id];

	Object.keys(wahlbezirk.zweitstimmen.parteien).forEach((partei) => {
		const bezirksPartei = wahlbezirk.zweitstimmen.parteien[partei] || 0;
		const bundesPartei = bundesergebnis.zweitstimmen.parteien[partei] || 0;

		if (bezirksPartei !== bundesPartei) {
			const diff = Math.abs(bezirksPartei - bundesPartei);
			totalPartei[partei] = (totalPartei[partei] || 0) + diff;

			totalBezirk[wahlbezirkName] = (totalBezirk[wahlbezirkName] || 0) + diff;

			result.push({
				wahlbezirk: wahlbezirkName,
				partei,
				wahlbezirkStimmen: bezirksPartei,
				bundesStimmen: bundesPartei,
				diff,
			});
		}
	});
});

result = result.sort((a, b) => {
	return totalBezirk[b.wahlbezirk] - totalBezirk[a.wahlbezirk];
});

console.table(result);

Object.values(result).forEach((x) => {});

console.table(Object.fromEntries(Object.entries(totalPartei).sort((a, b) => a[1] - b[1])));

console.log(Object.values(totalPartei).reduce((acc, x) => acc + x, 0));

fs.writeFileSync(__dirname + "/data/total.json", JSON.stringify(totalPartei, null, 2));
fs.writeFileSync(__dirname + "/data/list.json", JSON.stringify(result, null, 2));
