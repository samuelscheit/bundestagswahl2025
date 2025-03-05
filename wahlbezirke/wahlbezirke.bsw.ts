import type { ResultType } from "./scrape";

const wahlbezirke = require("./data/wahlbezirke.json");

const result = [] as {
	gemeinde: string;
	bezirk: string;
	BD: number;
	BSW: number;
}[];

Object.entries(wahlbezirke).forEach(([gemeinde, wahlbezirke]) => {
	Object.entries(wahlbezirke as any).forEach(([bezirk, x]) => {
		const wahlbezirk = x as ResultType;
		const { parteien } = wahlbezirk.zweitstimmen;

		const BD = parteien["BÜNDNIS DEUTSCHLAND"];
		const BSW = parteien.BSW;

		if (BD > BSW) {
			result.push({ gemeinde, bezirk, BD, BSW });
		}
	});
});

console.table(
	result.sort((a, b) => {
		return Math.abs(b.BD - b.BSW) - Math.abs(a.BD - a.BSW);
	})
);
