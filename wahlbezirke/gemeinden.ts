import fs from "fs";
import csv from "csv-parser";
import type { ResultType } from "./scrape";

export const gemeinden = new Map<
	string,
	Required<
		Omit<ResultType, "erststimmen" | "zweitstimmen" | "anzahl_wähler" | "anzahl_berechtigte" | "wahlbezirk_name" | "wahlbezirk_id">
	>
>();

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

			gemeinden.set(cleanGemeindeName(GemeindeName), {
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
			});
		})
		.on("end", resolve);
});

export function cleanGemeindeName(name: string) {
	return name.toLowerCase().replaceAll(",", "").replace("stadt", "").trim();
}
