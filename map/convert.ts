import shp from "shpjs";
import fs from "fs";
import { spawn } from "child_process";

const plzFile = fs.readFileSync(__dirname + "/data/plz.zip");
const plzGeojson = (await shp(plzFile)) as shp.FeatureCollectionWithFilename[];
fs.writeFileSync(__dirname + "/data/plz.json", JSON.stringify(plzGeojson, null, "\t"));

const shapeFileZip = fs.readFileSync(__dirname + "/data/NRWShapefile.zip");
const geojson = (await shp(shapeFileZip)) as shp.FeatureCollectionWithFilename[];

const gemeinden = geojson.find((x) => x.fileName === "dvg2gem_nw")!;

fs.writeFileSync(__dirname + "/data/gemeinde.json", JSON.stringify(gemeinden, null, "\t"));

var tippecanoe = spawn(`tippecanoe --force -o gemeinde.mbtiles -zg --drop-densest-as-needed gemeinde.json`, {
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
