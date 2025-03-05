import type { ResultType } from "./scrape";

const wahlbezirke = require("./data/wahlbezirke.json");

const result = [] as {
	gemeinde: string;
	bezirk: string;
	BD: number;
	BSW: number;
}[];

const alleParteien = new Set<string>();
let possibleBSW = 0;
let possibleBD = 0;

Object.entries(wahlbezirke).forEach(([gemeinde, wahlbezirke]) => {
	Object.entries(wahlbezirke as any).forEach(([bezirk, x]) => {
		const wahlbezirk = x as ResultType;
		if (!wahlbezirk.zweitstimmen) throw new Error("no zweitstimmen: " + gemeinde + " " + bezirk);
		const { parteien } = wahlbezirk.zweitstimmen;

		const BD = parteien["BÜNDNIS DEUTSCHLAND"];
		const BSW = parteien.BSW;

		for (const partei in parteien) {
			alleParteien.add(partei);
		}

		if (BD > BSW) {
			result.push({ gemeinde, bezirk, BD, BSW });
			possibleBD += BSW;
			possibleBSW += BD;
		}
	});
});

console.table(
	result.sort((a, b) => {
		return Math.abs(b.BD - b.BSW) - Math.abs(a.BD - a.BSW);
	})
);

console.log("Gemeinden", Object.keys(wahlbezirke).length);
console.log(
	"Wahlbezirke",
	Object.values(wahlbezirke).reduce((acc: number, x) => acc + Object.keys(x as any).length, 0)
);
// console.log("Parteien", alleParteien);

console.log("Potentielle vertauschte Stimmen BSW", possibleBSW);
console.log("Potentielle vertauschte Stimmen BD", possibleBD);
