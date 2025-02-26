import { Bundeswahlleiter } from "./bundeswahlleiter/read";
import _Wahlbezirke from "./wahlbezirke/data/out.json";
import type { defaultResult } from "./wahlbezirke/scrape";
import { wahlbezirkeNamen } from "./wahlbezirke/wahlbezirke";

const Wahlbezirke = _Wahlbezirke as any as Record<string, ReturnType<typeof defaultResult>>;

Bundeswahlleiter;
Wahlbezirke;

let result = {} as Record<
	string,
	{
		wahlbezirk: string;
		partei: string;
		wahlbezirkStimmen: number;
		bundesStimmen: number;
		diff: number;
	}
>;

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

			result[id] = {
				wahlbezirk: wahlbezirkName,
				partei,
				wahlbezirkStimmen: bezirksPartei,
				bundesStimmen: bundesPartei,
				diff,
			};
		}
	});
});

result = Object.fromEntries(Object.entries(result).sort((a, b) => a[1].diff - b[1].diff));

console.table(result);

Object.values(result).forEach((x) => {});

console.table(Object.fromEntries(Object.entries(totalPartei).sort((a, b) => a[1] - b[1])));

console.log(Object.values(totalPartei).reduce((acc, x) => acc + x, 0));
