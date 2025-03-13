import fs from "fs";
import csv from "csv-parser";
import type { ResultType } from "./scrape";
import { distance } from "fastest-levenshtein";

type Gemeinde = Omit<
	ResultType,
	"erststimmen" | "zweitstimmen" | "anzahl_wähler" | "anzahl_berechtigte" | "wahlbezirk_name" | "wahlbezirk_id"
> & {
	verbands_id: string | null;
	verbands_name: string | null;
	region_name: string | null;
	gemeinde_clean?: string;
	verbands_clean?: string;
};

export const gemeinden = [] as Gemeinde[];

const duplicates = new Map<string, number>();

export const gemeindeSuffixes = new Set<string>();

await new Promise((resolve) => {
	fs.createReadStream(__dirname + "/data/gemeinden.csv", "utf8")
		.pipe(
			csv({
				separator: ";",
				skipLines: 7,
			})
		)
		.on("data", (data) => {
			const {
				"Wahlkreis-Nr": WahlkreisNr,
				"Wahlkreis-Bez": WahlkreisName,
				RGS_Land: LandNr,
				RGS_RegBez: RegionNr,
				RGS_Kreis: KreisNr,
				RGS_GemVerband: GemeindeverbandNr,
				RGS_Gemeinde: GemeindeNr,
				Landname: LandName,
				"RegBez-Name": RegionName,
				Kreisname: KreisName,
				"GemVerband-Name": GemeindeverbandName,
				Gemeindename: GemeindeName,
				Gemeindeteil: Gemeindeteil,
				"Wahlkreis-von": WahlkreisVon,
				"Wahlkreis-bis": WahlkreisBis,
				"PLZ-GemVerwaltung": PLZGemVerwaltung,
				"PLZ-mehrere": PLZMehrere,
			} = data as Record<string, string>;

			duplicates.set(GemeindeName, (duplicates.get(GemeindeName) || 0) + 1);

			const value = {
				bundesland_id: LandNr || null,
				bundesland_name: LandName || null,
				gemeinde_id: GemeindeNr || null,
				gemeinde_name: GemeindeName || null,
				kreis_id: KreisNr || null,
				kreis_name: KreisName || null,
				ortsteil_id: Gemeindeteil || null,
				ortsteil_name: Gemeindeteil || null,
				wahlkreis_id: WahlkreisNr || null,
				wahlkreis_name: WahlkreisName || null,
				verbands_id: GemeindeverbandNr || null,
				verbands_name: GemeindeverbandName || null,
				region_name: RegionName || null,
				gemeinde_clean: undefined,
				verbands_clean: undefined,
			};

			for (const suffix of GemeindeName?.split(", ")[1]?.split(" ") || []) {
				if (suffix) gemeindeSuffixes.add(suffix);
			}

			gemeinden.push(value);
		})
		.on("end", resolve);
});

gemeindeSuffixes.add("wallfahrtsstadt");
gemeindeSuffixes.add("alte hansestadt");
gemeindeSuffixes.add("bürgermeisteramt");
gemeindeSuffixes.add("energiestadt");
gemeindeSuffixes.add("der gemeindevorstand der");
gemeindeSuffixes.add("reformationsstadt");
gemeindeSuffixes.add("Universitäts- und Hansestadt");
gemeindeSuffixes.add("stadtverwaltung");
gemeindeSuffixes.add("odw.");
gemeindeSuffixes.add("(westf.)");
gemeindeSuffixes.add("alte hansestadt");
gemeindeSuffixes.add("kreis- und hansestadt");
gemeindeSuffixes.add("landkreis");
gemeindeSuffixes.add("verbandsgemeinde");
gemeindeSuffixes.add("samtgemeinde");
gemeindeSuffixes.add("gemeinde");
gemeindeSuffixes.add("große kreisstadt");
gemeindeSuffixes.add("kreis- und kurstadt");
gemeindeSuffixes.add("vvg der stadt");
gemeindeSuffixes.add("kreis");
gemeindeSuffixes.add('"');
gemeindeSuffixes.delete("/");
gemeindeSuffixes.add("marktstadt");
gemeindeSuffixes.add("Mittelstadt");
gemeindeSuffixes.add("EGem");
gemeindeSuffixes.add("Gemeindevorstand der Gemeinde");
gemeindeSuffixes.add("Nordseeheilbad");
gemeindeSuffixes.add("Nordseeheilbad");
gemeindeSuffixes.add("(Ems)");
gemeindeSuffixes.add("Verwaltungsgemeinschaft");
gemeindeSuffixes.add("Einheitsgemeinde");
gemeindeSuffixes.add("Magistrat der Stadt");
gemeindeSuffixes.add("/Ostfriesland");
gemeindeSuffixes.add("Gartenstadt");
gemeindeSuffixes.add("Gemeindewahlbehörde");

for (const suffix of [...gemeindeSuffixes.values()]) {
	gemeindeSuffixes.delete(suffix);
	gemeindeSuffixes.add(suffix.toLowerCase());
}

export const gemeindeCleanRegex = new RegExp(
	Array.from(gemeindeSuffixes)
		.filter((x) => x)
		.sort((a, b) => b.length - a.length)
		.map((x) => "(" + x.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&") + ")")
		.join("|") + "|\\d{5}",
	"gi"
);

gemeinden.forEach((v) => {
	v.gemeinde_clean = cleanGemeindeName(v.gemeinde_name);
	v.verbands_clean = cleanGemeindeName(v.verbands_name);
});

export function cleanGemeindeName(name?: string | null) {
	if (!name) return "";

	name = name
		.toLowerCase()
		.replaceAll("(rhld.)", "(Rheinland)")
		.replaceAll("(oldb)", "(Oldenburg)")
		.replaceAll("a.d.str.", "an der straße")
		.replaceAll("a.t.w.", "am teutoburger wald")
		.replaceAll(gemeindeCleanRegex, "");

	if (name.includes(",")) {
		const [a, b] = name.split(", ");
		name = b + " " + a;
	}

	return name.trim();
}

export function cleanKreisName(name?: string | null) {
	if (!name) return "";
	if (name.includes(",")) {
		const [a, b] = name.split(", ");
		name = b + " " + a;
	}

	return name
		.toLowerCase()
		.replaceAll(/Landkreis/gi, "")
		.trim();
}

export function getGemeinde(name: string, kreis?: string) {
	name = cleanGemeindeName(name);
	kreis = kreis ? cleanKreisName(kreis) : undefined;

	let min_distance = Infinity;
	let verband_distance = Infinity;
	let value = null;
	let verband_value = null;

	const duplicates = [] as Gemeinde[];

	for (const v of gemeinden) {
		let distGemeinde = distance(v.gemeinde_clean || "", name);
		let distGemeinde2 = distance(v.gemeinde_name?.split(", ")[0] || "", name);

		if (distGemeinde2 < distGemeinde) {
			distGemeinde = distGemeinde2;
		}

		v.gemeinde_clean?.split(" / ").forEach((n) => {
			const dist = distance(n, name);
			if (dist < distGemeinde) {
				distGemeinde = dist;
			}
		});

		const distVerband = distance(v.verbands_clean || "", name);

		if (distVerband <= verband_distance) {
			verband_distance = distVerband;
			verband_value = v;
		}

		if (distGemeinde <= min_distance) {
			min_distance = distGemeinde;

			if (distGemeinde <= 3) {
				value = v;
			}

			if (distGemeinde === 0) {
				duplicates.push(v);
			}
		}
	}

	if (duplicates.length > 1 && kreis) {
		for (const v of duplicates) {
			if (v.kreis_name && v.kreis_name.toLowerCase() === kreis) {
				value = v;
				break;
			}
		}
	} else if (duplicates.length === 1) {
		value = duplicates[0];
	}

	if (!value) {
		value = { ...verband_value, gemeinde_name: null, gemeinde_id: null };
	}

	return value;
}

// console.log(getGemeinde("Kreis- und Kurstadt Bad Schwalbach", "Rheingau-Taunus-Kreis"));
