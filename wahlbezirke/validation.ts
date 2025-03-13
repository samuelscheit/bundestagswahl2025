import type { ResultType } from "../wahlkreise/scrape";

const wahlbezirke = require("./data/wahlbezirkeList.json") as ResultType[];
wahlbezirke.forEach((x) => {
	let stimmen = 0;

	Object.entries(x.zweitstimmen.parteien).forEach(([partei, value]) => {
		stimmen += value;
	});

	if (stimmen !== x.zweitstimmen.gültig) {
		console.error("Missing Stimmen", x, stimmen, x.zweitstimmen.gültig);
	}
});
