import fs from "fs";
import csv from "csv-parser";
import { getIdFromName, type ResultType } from "../wahlkreise/scrape";
import { distance } from "fastest-levenshtein";
import { getIdFromResult } from "./wahlbezirke";

type Gemeinde = Omit<
	ResultType,
	"erststimmen" | "zweitstimmen" | "anzahl_wähler" | "anzahl_berechtigte" | "wahlbezirk_name" | "wahlbezirk_id"
> & {
	verband_id: string | null;
	verband_name: string | null;
	region_name: string | null;
	gemeinde_clean?: string;
	verband_clean?: string;
	kreis_clean?: string;
	wahlkreis_clean?: string;
};

export const gemeinden = [] as Gemeinde[];
// land > region > kreis > verband|gemeinde
const gemeindenHierarchy = {} as Record<string, Record<string, Record<string, Record<string, Gemeinde[]>>>>;

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
			var {
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

			const suffixes = GemeindeName?.split(", ").slice(1);

			for (const suffix of suffixes || []) {
				gemeindeSuffixes.add(suffix);
			}

			GemeindeName = fixCommaName(GemeindeName);

			duplicates.set(GemeindeName, (duplicates.get(GemeindeName) || 0) + 1);

			const value = {
				bundesland_id: getIdFromName(LandNr) || null,
				bundesland_name: LandName || null,
				gemeinde_id: getIdFromName(GemeindeNr) || null,
				gemeinde_name: GemeindeName || null,
				kreis_id: getIdFromName(KreisNr) || null,
				kreis_name: KreisName || null,
				ortsteil_id: getIdFromName(Gemeindeteil) || null,
				ortsteil_name: Gemeindeteil || null,
				wahlkreis_id: getIdFromName(WahlkreisNr) || null,
				wahlkreis_name: WahlkreisName || null,
				verband_id: getIdFromName(GemeindeverbandNr) || null,
				verband_name: GemeindeverbandName || null,
				region_name: RegionName || null,
				gemeinde_clean: undefined,
				verband_clean: undefined,
				kreis_clean: undefined,
				wahlkreis_clean: undefined,
			};

			LandNr = Number(LandNr).toString();
			RegionNr = Number(RegionNr).toString();
			KreisNr = Number(KreisNr).toString();
			GemeindeverbandNr = Number(GemeindeverbandNr).toString();
			GemeindeNr = Number(GemeindeNr).toString();

			gemeindenHierarchy[LandNr] ||= {};
			gemeindenHierarchy[LandNr][RegionNr] ||= {};
			gemeindenHierarchy[LandNr][RegionNr][KreisNr] ||= {};
			gemeindenHierarchy[LandNr][RegionNr][KreisNr][GemeindeverbandNr] ||= [];
			gemeindenHierarchy[LandNr][RegionNr][KreisNr][GemeindeverbandNr].push(value);
			gemeindenHierarchy[LandNr][RegionNr][KreisNr][GemeindeNr] ||= [];
			gemeindenHierarchy[LandNr][RegionNr][KreisNr][GemeindeNr].push(value);

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
gemeindeSuffixes.add("(westf.)");
gemeindeSuffixes.add("alte hansestadt");
gemeindeSuffixes.add("kreis- und hansestadt");
gemeindeSuffixes.add("landkreis");
gemeindeSuffixes.add("verbandsgemeinde");
gemeindeSuffixes.add("samtgemeinde");
gemeindeSuffixes.add("gemeinde");
gemeindeSuffixes.add("große kreisstadt");
gemeindeSuffixes.add("kreisstadt");
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
gemeindeSuffixes.add("Gartenstadt");
gemeindeSuffixes.add("Gemeindewahlbehörde");
gemeindeSuffixes.add("v. d. höhe");
gemeindeSuffixes.add("Landgemeinde");
gemeindeSuffixes.add("Seebad");
gemeindeSuffixes.add("Landeshauptstadt");
gemeindeSuffixes.add("-");

for (const suffix of gemeindeSuffixes) {
	if (suffix.includes("  ")) {
		gemeindeSuffixes.add(suffix.replaceAll(/\s+/g, " "));
	}
}

export const gemeindeCleanRegex = new RegExp(
	Array.from(gemeindeSuffixes)
		.filter((x) => x)
		.sort((a, b) => b.length - a.length)
		.map((x) => "(\\s" + x.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&") + "\\s)")
		.join("|") + "|\\d{5,}",
	"gi"
);

gemeinden.forEach((v) => {
	v.gemeinde_clean = cleanGemeindeName(v.gemeinde_name);
	v.verband_clean = cleanGemeindeName(v.verband_name);
	v.kreis_clean = cleanKreisName(v.kreis_name);
	v.wahlkreis_clean = cleanKreisName(v.wahlkreis_name);
});

function fixCommaName(name: string) {
	if (name.includes(",")) {
		const [a, b] = name.split(",");
		name = " " + (b || "") + " " + (a || "") + " ";
	}

	return name.trim();
}

export function cleanGemeindeName(name?: string | null) {
	if (!name) return "";

	name = ` ${name} `
		.toLowerCase()
		.replaceAll("/ ", "/")
		.replaceAll("/ostfriesland", "")
		.replaceAll("/odw.", "")
		.replaceAll("rhld.", "rheinland")
		.replaceAll("(oldb)", "(oldenburg)")
		.replaceAll("a.d.str.", "an der straße")
		.replaceAll("a.t.w.", "am teutoburger wald");

	let previousName = "";

	while (previousName !== name) {
		previousName = name;
		name = name.replaceAll(gemeindeCleanRegex, " ");
	}

	return name.replace(/\s+/g, " ").trim();
}

export function cleanKreisName(name?: string | null) {
	if (!name) return "";
	if (name.includes(",")) {
		const [a, b] = name.split(", ");
		name = b + " " + a;
	}

	return name
		.toLowerCase()
		.replaceAll(/Landkreis|wahlkreis|stadt/gi, "")
		.trim();
}

const AGS = /(?<land>\d{2})(?<region>\d{1})(?<kreis>\d{2})((?<verband>\d{4})|(?<gemeinde>\d{3}))/;

function getGemeindeByIDInternal(url: string) {
	const id = url.match(/^.+\/(\d+)\//)?.[1];
	if (!id) throw new Error("Invalid ID: " + url);

	const ags = id.match(AGS);
	if (!ags) throw new Error("Invalid AGS: " + url);

	var { land, region, kreis, verband, gemeinde: gemeindeId } = (ags.groups || {}) as Record<string, string | undefined>;

	if (!land) throw new Error("Invalid AGS land: " + url);
	if (!region) throw new Error("Invalid AGS region: " + url);
	if (!kreis) throw new Error("Invalid AGS kreis: " + url);

	land = Number(land).toString();
	region = Number(region).toString();
	kreis = Number(kreis).toString();
	verband = verband ? Number(verband).toString() : undefined;

	const kreisGemeinde = gemeindenHierarchy[land]?.[region]?.[kreis];
	var gemeinden: Gemeinde[] | undefined;

	if (verband) {
		verband = Number(verband).toString();
		gemeinden = kreisGemeinde?.[verband];
	} else if (gemeindeId) {
		gemeindeId = Number(gemeindeId).toString();
		gemeinden = kreisGemeinde?.[gemeindeId];
	}

	const gemeinde = gemeinden?.find((x) => x.gemeinde_id === gemeindeId || x.verband_id === verband);

	if (!gemeinde && gemeindeId === "0") {
		const anyKreisGemeinde = Object.values(kreisGemeinde).flat();
		if (!anyKreisGemeinde.length) throw new Error("Invalid AGS kreis not found: " + url);

		const gemeinde = anyKreisGemeinde[0]!;

		return { ...gemeinde, gemeinde_id: null, gemeinde_name: null, verband_id: null, verband_name: null };
	}

	if (!gemeinden) {
		throw new Error("Invalid AGS gemeinden not found: " + url);
	}

	if (!gemeinde) {
		throw new Error("Invalid AGS gemeinde not found: " + url);
	}

	if (verband) {
		return { ...gemeinde, gemeinde_id: null, gemeinde_name: null };
	} else {
		return { ...gemeinde };
	}
}

export function getGemeindeByID(url: string) {
	const result = getGemeindeByIDInternal(url);
	delete result.gemeinde_clean;
	delete result.verband_clean;
	delete result.kreis_clean;
	delete result.wahlkreis_clean;

	return result as Gemeinde;
}

export function getGemeindeByIDorNull(url: string) {
	try {
		return getGemeindeByIDInternal(url);
	} catch (error) {
		return null;
	}
}

export function getGemeinde(name: string, kreis?: string) {
	name = cleanGemeindeName(name);
	const kreisGemeinde = kreis ? cleanGemeindeName(kreis || "") : undefined;
	kreis = kreis ? cleanKreisName(kreis) : undefined;

	let min_distance = Infinity;
	let verband_distance = Infinity;
	let value = null;
	let verband_value = null;

	let duplicates = [] as Gemeinde[];

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

		let distVerband = distance(v.verband_clean || "", name);

		if (distVerband <= verband_distance && distVerband < 3) {
			verband_distance = distVerband;
			verband_value = v;
		}

		if (kreisGemeinde) {
			distVerband = distance(v.verband_name || "", kreisGemeinde);

			if (distVerband < verband_distance) {
				verband_distance = distVerband;
				verband_value = v;
			}
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

	if (duplicates.length > 1 && kreis && kreisGemeinde) {
		let min_distance = Infinity;

		const summedDist = [] as [number, Gemeinde][];

		for (const v of duplicates) {
			const dist = Math.min(
				distance(v.verband_clean || "", kreisGemeinde),
				distance(v.gemeinde_clean || "", kreisGemeinde),
				distance(v.kreis_clean || "", kreis),
				distance(v.wahlkreis_clean || "", kreis),
				distance(v.kreis_clean + " " + v.kreis_id, kreis),
				distance(v.wahlkreis_clean + " " + v.wahlkreis_id, kreis)
			);

			if (dist < min_distance) {
				min_distance = dist;
				value = v;
			}

			const sum = distance(v.gemeinde_clean || "", name) + dist + distance(v.verband_clean || "", name);

			summedDist.push([sum, v]);
		}

		const least = summedDist.sort((a, b) => a[0] - b[0]);

		value = least[0][1];
		min_distance = least[0][0];
	} else if (duplicates.length === 1) {
		value = duplicates[0];
	}

	if (verband_distance < min_distance) {
		value = { ...verband_value, gemeinde_name: null, gemeinde_id: null };
	}

	const newValue = { ...value };
	delete newValue.gemeinde_clean;
	delete newValue.verband_clean;
	delete newValue.kreis_clean;
	delete newValue.wahlkreis_clean;

	return newValue as Gemeinde;
}
