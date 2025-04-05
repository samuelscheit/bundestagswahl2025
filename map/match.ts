import { calculatePercentage, type ResultType } from "../wahlkreise/scrape";
import { wahlergebnis } from "../wahlbezirke/accumulate";
import { spawn } from "child_process";
import fs from "fs";

type Properties = {
	OBJID: string;
	BEGINN: string;
	ADE: number;
	GF: number;
	BSG: number;
	ARS: string;
	AGS: string;
	SDV_ARS: string;
	GEN: string;
	BEZ: string;
	IBZ: number;
	BEM: string;
	NBD: string;
	SN_L: string;
	SN_R: string;
	SN_K: string;
	SN_V1: string;
	SN_V2: string;
	SN_G: string;
	FK_S3: string;
	NUTS: string;
	ARS_0: string;
	AGS_0: string;
	WSK: string;
	DLM_ID: string;
};

const gemeinden = require("./data/gemeinde.json") as GeoJSON.FeatureCollection;

gemeinden.features.forEach((feature) => {
	if (!feature.properties) return;

	const properties = feature.properties as Properties;

	const land_id = Number(properties.SN_L).toString();
	const region_id = Number(properties.SN_R).toString();
	const kreis_id = Number(properties.SN_K).toString();
	const verband_id = Number(properties.SN_V1 + properties.SN_V2).toString();
	const gemeinde_id = Number(properties.SN_G).toString();

	const verband = wahlergebnis[land_id]?.[region_id]?.[kreis_id]?.[verband_id];
	const gemeinde =
		wahlergebnis[land_id]?.[region_id]?.[kreis_id]?.[verband_id]?.[gemeinde_id] ||
		wahlergebnis[land_id]?.[region_id]?.[kreis_id]?.["0"]?.[gemeinde_id];
	const wahl = gemeinde || verband;

	if (gemeinde_id === "0" && verband_id === "0") {
		// big city
		console.log(land_id, region_id, kreis_id, verband_id, gemeinde_id, wahl.result.gemeinde_name);
	}

	const ergebnis = calculatePercentage(wahl?.result.zweitstimmen);

	let leading_party = null as string | null;

	if (ergebnis) {
		let max = 0;
		Object.entries(ergebnis).forEach(([key, value]) => {
			if (value > max) {
				max = value;
				leading_party = key;
			}
		});
	}

	feature.properties = {
		...ergebnis,
		name: properties.GEN,
		verband_name: !gemeinde ? verband?.result?.verband_name : undefined,
		leading_party,
	};
});

fs.writeFileSync(__dirname + "/data/wahlergebnis.json", JSON.stringify(gemeinden, null, 2));

var tippecanoe = spawn(
	`tippecanoe --no-tile-size-limit --no-feature-limit --force -o wahlergebnis.mbtiles -zg --extend-zooms-if-still-dropping -l gemeinde wahlergebnis.json`,
	{
		shell: true,
		cwd: __dirname + "/data/",
	}
);

tippecanoe.stdout.pipe(process.stdout);
tippecanoe.stderr.pipe(process.stderr);

await new Promise((resolve) => tippecanoe.once("close", resolve));

tippecanoe = spawn(`tile-join -pk --force -o map.mbtiles wahlergebnis.mbtiles bundesland.mbtiles germany_place.mbtiles`, {
	shell: true,
	cwd: __dirname + "/data/",
});

// tippecanoe.stdout.pipe(process.stdout);
// tippecanoe.stderr.pipe(process.stderr);

/*
tile-join --force -o map.mbtiles wahlergebnis.mbtiles bundesland.mbtiles 
*/
