import type { ResultType } from "../wahlkreise/scrape";

const wahlbezirke = require("./data/wahlbezirke.json");

const resultBD = [] as {
	gemeinde: string;
	bezirk: string;
	BSW: number;
	BD: number;
}[];

const resultMLPD = [] as {
	gemeinde: string;
	bezirk: string;
	BSW: number;
	MLPD: number;
}[];

const resultMera25 = [] as {
	gemeinde: string;
	bezirk: string;
	BSW: number;
	Mera25: number;
}[];

const resultWU = [] as {
	gemeinde: string;
	bezirk: string;
	BSW: number;
	WU: number;
}[];

const alleParteien = new Set<string>();
let possibleBSW = 0;

Object.entries(wahlbezirke).forEach(([gemeinde, wahlbezirke]) => {
	Object.entries(wahlbezirke as any).forEach(([bezirk, x]) => {
		const wahlbezirk = x as ResultType;
		if (!wahlbezirk.zweitstimmen) throw new Error("no zweitstimmen: " + gemeinde + " " + bezirk);
		const { parteien } = wahlbezirk.zweitstimmen;

		const BD = parteien["BÜNDNIS DEUTSCHLAND"];
		const BSW = parteien.BSW;
		const WU = parteien["WerteUnion"];
		const MLPD = parteien.MLPD;
		const Mera25 = parteien["MERA25"];

		for (const partei in parteien) {
			alleParteien.add(partei);
		}

		if (BD > BSW) {
			resultBD.push({ gemeinde, bezirk, BD, BSW });
			possibleBSW += BD - BSW;
		}

		if (WU > BSW) {
			resultWU.push({ gemeinde, bezirk, WU, BSW });
			possibleBSW += WU - BSW;
		}

		if (MLPD > BSW) {
			resultMLPD.push({ gemeinde, bezirk, MLPD, BSW });
			possibleBSW += MLPD - BSW;
		}

		if (Mera25 > BSW) {
			resultMera25.push({ gemeinde, bezirk, Mera25, BSW });
			possibleBSW += Mera25 - BSW;
		}
	});
});

console.table(
	resultBD.sort((a, b) => {
		return Math.abs(b.BD - b.BSW) - Math.abs(a.BD - a.BSW);
	})
);

console.table(
	resultWU.sort((a, b) => {
		return Math.abs(b.WU - b.BSW) - Math.abs(a.WU - a.BSW);
	})
);

console.table(
	resultMLPD.sort((a, b) => {
		return Math.abs(b.MLPD - b.BSW) - Math.abs(a.MLPD - a.BSW);
	})
);

console.table(
	resultMera25.sort((a, b) => {
		return Math.abs(b.Mera25 - b.BSW) - Math.abs(a.Mera25 - a.BSW);
	})
);

console.log("Gemeinden", Object.keys(wahlbezirke).length);
console.log(
	"Wahlbezirke",
	Object.values(wahlbezirke).reduce((acc: number, x) => acc + Object.keys(x as any).length, 0)
);
console.log("Parteien", alleParteien);

console.log("Potentielle vertauschte Stimmen BSW", possibleBSW);
