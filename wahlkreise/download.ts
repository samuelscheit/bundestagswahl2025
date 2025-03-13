import { download } from "./scrape";
import { bundeslandNamen, bundeslandWahlkreise, wahlkreiseBundesland, wahlkreiseNamen, wahlkreiseQuellen } from "./wahlkreise";
import fs from "fs";

let WASTest = [
	1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 36, 44, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 69, 71, 74, 75, 76, 77, 78, 79, 80, 81, 82,
	84, 85, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235,
	236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254, 255, 256, 257, 296, 297, 298, 299,
];

let votemanagerTest: number[] = [
	86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 114, 115, 116, 117, 118, 119, 120,
	121, 122, 123, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 141, 142, 143, 144, 145, 146, 147, 148, 149,
	161, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 181, 182, 183, 184, 185, 260, 261, 262, 263, 264, 265, 266,
	267, 268, 269, 270, 271, 272, 273, 274, 275, 276, 277, 278, 279, 280, 281, 282, 283, 284, 285, 286, 287, 288, 289, 290, 291, 292, 293,
	294, 295,
];

const thüringen = bundeslandWahlkreise["16"];

let test = Object.keys(wahlkreiseQuellen);
// let test: number[] = [192];
// let test: number[] = WASTest;
// let test = thüringen;

const finalResult = require("./data/out.json");

for (const i of test) {
	const id = i.toString() as keyof typeof wahlkreiseQuellen;
	console.log("Downloading", id, wahlkreiseQuellen[id]);
	const result = await download({
		id: id,
		url: wahlkreiseQuellen[id],
	});
	if (!result) continue;

	result.wahlkreis_id = id;
	result.wahlkreis_name = wahlkreiseNamen[id];
	result.bundesland_id = wahlkreiseBundesland[id];
	result.bundesland_name = bundeslandNamen[result.bundesland_id as any as keyof typeof bundeslandNamen];
	// @ts-ignore
	delete result.kreis_id; // @ts-ignore
	delete result.kreis_name; // @ts-ignore
	delete result.wahlbezirk_id; // @ts-ignore
	delete result.wahlbezirk_name; // @ts-ignore
	delete result.gemeinde_id; // @ts-ignore
	delete result.gemeinde_name; // @ts-ignore
	delete result.ortsteil_id; // @ts-ignore
	delete result.ortsteil_name;

	finalResult[id] = result;

	console.log(i, result);

	fs.writeFileSync(__dirname + "/data/out.json", JSON.stringify(finalResult, null, "\t"));
}

Object.values(finalResult).forEach((x: any) => {
	Object.keys(x.zweitstimmen.parteien).forEach((partei) => {
		const val = x.zweitstimmen.parteien[partei];
		delete x.zweitstimmen.parteien[partei];

		let cleanedName = partei
			.toUpperCase()
			.replaceAll("–", "-")
			.replace("DIE GERECHTIGKEITSPARTEI - ", "")
			.replace("DIE HUMANISTEN", "PDH");

		if (cleanedName === "TEAM TODEN") cleanedName = "TEAM TODENHÖFER";

		x.zweitstimmen.parteien[cleanedName] = val;
	});
});

fs.writeFileSync(__dirname + "/data/out.json", JSON.stringify(finalResult, null, "\t"));
