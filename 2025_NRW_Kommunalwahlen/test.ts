import { writeFileSync } from "fs";
import { getGemeinde, getGemeindeByID } from "../wahlbezirke/gemeinden";
import { download } from "../wahlkreise/scrape";

const result = await download({
	id: "",
	url: "https://wahl.krzn.de/kw2025/wep250/",
	// url: "https://votemanager-da.ekom21cdn.de/2025-02-23/06439001/praesentation/"
});

console.dir(result, { depth: null, maxArrayLength: null });

writeFileSync(__dirname + "/result2.json", JSON.stringify(result, null, 2));
