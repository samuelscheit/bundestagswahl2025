import shp from "shpjs";
import fs from "fs";
import * as turf from "@turf/turf";
import { spawn } from "child_process";

// const shapeFileZip = fs.readFileSync(__dirname + "/WahlkreiseShapefile.zip");
const shapeFileZip = fs.readFileSync(__dirname + "/GemeindenShapefile.zip");
const geojson = (await shp(shapeFileZip)) as shp.FeatureCollectionWithFilename[];

const gemeinden = geojson.find((x) => x.fileName === "EPSG_25832/VG250_GEM")!;

fs.writeFileSync(__dirname + "/gemeinde.json", JSON.stringify(gemeinden, null, "\t"));

fs.writeFileSync(
	__dirname + "/kreis.json",
	JSON.stringify(
		geojson.find((x) => x.fileName === "EPSG_25832/VG250_KRS"),
		null,
		"\t"
	)
);

const bundeslaender = geojson.find((x) => x.fileName === "EPSG_25832/VG250_LAN")!;

fs.writeFileSync(__dirname + "/bundesland.json", JSON.stringify(bundeslaender, null, "\t"));

const bundesländerReduced = {} as Record<string, GeoJSON.Feature[]>;

bundeslaender.features.forEach((feature) => {
	const land = (bundesländerReduced[feature.properties?.GEN] ||= []);

	land.push(feature);
});

fs.writeFileSync(
	__dirname + "/verband.json",
	JSON.stringify(
		geojson.find((x) => x.fileName === "EPSG_25832/VG250_VWG"),
		null,
		"\t"
	)
);

var tippecanoe = spawn(`tippecanoe --force -o bundesland.mbtiles -zg --drop-densest-as-needed bundesland.json`, {
	shell: true,
	cwd: __dirname,
});

tippecanoe.stdout.pipe(process.stdout);
tippecanoe.stderr.pipe(process.stderr);

await new Promise((resolve) => tippecanoe.once("close", resolve));

tippecanoe = spawn(`tippecanoe --force -o bundesland_name.mbtiles bundesland_name.json`, {
	shell: true,
	cwd: __dirname,
});

tippecanoe.stdout.pipe(process.stdout);
tippecanoe.stderr.pipe(process.stderr);

await new Promise((resolve) => tippecanoe.once("close", resolve));

/*

tippecanoe --force -o gemeinde.mbtiles -zg --extend-zooms-if-still-dropping gemeinde.json
tippecanoe --force -o bundesland.mbtiles -zg --drop-densest-as-needed bundesland.json
tile-join --force -o map.mbtiles gemeinde.mbtiles bundesland.mbtiles
tileserver-gl --file map.mbtiles           

tippecanoe --force -o bundesland_name.mbtiles bundesland_name.json

tippecanoe --force -o kreis.mbtiles -zg extend-zooms-if-still-dropping kreis.json
tile-join --force -o map.mbtiles gemeinde.mbtiles bundesland.mbtiles kreis.mbtiles

*/
