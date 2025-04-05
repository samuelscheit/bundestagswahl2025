import { csvParse } from "../wahlbezirke/util";
import fs from "fs";

export type Postleitzahl = {
	postleitzahl: string;
	bundesland_id: string;
	region_id: string;
	kreis_id: string;
	gemeinden: {
		name: string;
		gemeinde_id?: string;
		verband_id?: string;
		ortsteile: string[];
	}[];
};

const postleitzahlListe = require("./data/postleitzahlListe.json") as Postleitzahl[];

export const postleitzahlMap = new Map<string, Postleitzahl>();

postleitzahlListe.forEach((postleitzahl) => {
	postleitzahlMap.set(postleitzahl.postleitzahl, postleitzahl);
});

export const postleitzahlAgsMap = new Map<string, string[]>();

export const postleitzahlen: {
	osm_id: string;
	ags: string;
	ort: string;
	plz: string;
	landkreis: string;
	bundesland: string;
}[] = await csvParse({
	data: fs.readFileSync(__dirname + "/data/plz.csv", "utf-8"),
	separator: ",",
});

postleitzahlen.forEach((postleitzahl) => {
	if (!postleitzahlAgsMap.has(postleitzahl.plz)) {
		postleitzahlAgsMap.set(postleitzahl.plz, []);
	}
	postleitzahlAgsMap.get(postleitzahl.plz)!.push(postleitzahl.ags);
});
