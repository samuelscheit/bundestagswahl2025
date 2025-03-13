import fs from "fs";
import type { ResultType } from "../wahlkreise/scrape";
import { bundeslandNamen, wahlkreiseBundesland } from "../wahlkreise/wahlkreise";

let wahlbezirke = require("./data/wahlbezirkeList.json") as ResultType[];

wahlbezirke.forEach((x) => {
	if (!x.wahlkreis_id) throw new Error("Missing wahlkreis_id: " + JSON.stringify(x));

	const wahlkreis_id = String(parseInt(x.wahlkreis_id));

	x.bundesland_id = wahlkreiseBundesland[wahlkreis_id as any as keyof typeof wahlkreiseBundesland];
	if (!x.bundesland_id) throw new Error("Missing bundesland_id: " + JSON.stringify(x));

	x.bundesland_name = bundeslandNamen[x.bundesland_id as any as keyof typeof bundeslandNamen];
});

console.log([...new Set(wahlbezirke.map((x) => x.bundesland_id))].map((x) => Number(x)).sort((a, b) => a - b));

fs.writeFileSync(__dirname + "/data/wahlbezirkeList.json", JSON.stringify(wahlbezirke, null, "\t"));
