import shp from "shpjs";
import fs from "fs";
import { spawn } from "child_process";

const plzFile = fs.readFileSync(__dirname + "/data/plz.zip");
const plzGeojson = (await shp(plzFile)) as shp.FeatureCollectionWithFilename[];
fs.writeFileSync(__dirname + "/data/plz.json", JSON.stringify(plzGeojson, null, "\t"));

const shapeFileZip = fs.readFileSync(__dirname + "/data/GemeindenShapefile.zip");
const geojson = (await shp(shapeFileZip)) as shp.FeatureCollectionWithFilename[];

const gemeinden = geojson.find((x) => x.fileName === "EPSG_25832/VG250_GEM")!;

fs.writeFileSync(__dirname + "/data/gemeinde.json", JSON.stringify(gemeinden, null, "\t"));

fs.writeFileSync(
	__dirname + "/data/kreis.json",
	JSON.stringify(
		geojson.find((x) => x.fileName === "EPSG_25832/VG250_KRS"),
		null,
		"\t"
	)
);

const bundeslaender = geojson.find((x) => x.fileName === "EPSG_25832/VG250_LAN")!;

fs.writeFileSync(__dirname + "/data/bundesland.json", JSON.stringify(bundeslaender, null, "\t"));

const bundesländerReduced = {} as Record<string, GeoJSON.Feature[]>;

bundeslaender.features.forEach((feature) => {
	const land = (bundesländerReduced[feature.properties?.GEN] ||= []);

	land.push(feature);
});

fs.writeFileSync(
	__dirname + "/data/verband.json",
	JSON.stringify(
		geojson.find((x) => x.fileName === "EPSG_25832/VG250_VWG"),
		null,
		"\t"
	)
);

var tippecanoe = spawn(`tippecanoe --force -o bundesland.mbtiles -zg --drop-densest-as-needed bundesland.json`, {
	shell: true,
	cwd: __dirname + "/data/",
});

tippecanoe.stdout.pipe(process.stdout);
tippecanoe.stderr.pipe(process.stderr);

await new Promise((resolve) => tippecanoe.once("close", resolve));

/*

tippecanoe --force -o gemeinde.mbtiles -zg --extend-zooms-if-still-dropping gemeinde.json
tippecanoe --force -o bundesland.mbtiles -zg --drop-densest-as-needed bundesland.json
tile-join --force -o map.mbtiles gemeinde.mbtiles bundesland.mbtiles
tileserver-gl-light --file map.mbtiles           

tippecanoe --force -o kreis.mbtiles -zg extend-zooms-if-still-dropping kreis.json
tile-join --force -o map.mbtiles gemeinde.mbtiles bundesland.mbtiles kreis.mbtiles

*/
