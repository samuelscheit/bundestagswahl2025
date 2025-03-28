import * as turf from "@turf/turf";
import fs from "fs";
import { HTMLElement, parse } from "node-html-parser";
import { csvParse } from "../util";
import type { FeatureCollection, Polygon } from "geojson";

interface Feature {
	id: string;
	gemeinde: string;
	bezirksArt: string;
	bezirksNummer: string;
	geometry: GeoJSON.Geometry;
	feature: GeoJSON.Feature;
}

function parsePosList(posList: string): number[][] {
	const coords = posList.trim().split(/\s+/).map(Number);
	const result: number[][] = [];
	for (let i = 0; i < coords.length; i += 2) {
		result.push([coords[i], coords[i + 1]]);
	}
	return result;
}

function parsePolygon(polygonElement: HTMLElement): GeoJSON.Polygon {
	const posListElement = (polygonElement.getElementsByTagName("gml:posList") || polygonElement.getElementsByTagName("posList"))[0];
	if (!posListElement || !posListElement.textContent) {
		throw new Error("Kein posList-Element gefunden");
	}
	const coordinates = parsePosList(posListElement.textContent);
	return {
		type: "Polygon",
		coordinates: [coordinates],
	};
}

function parseFeature(featureElement: HTMLElement): Feature {
	const id = featureElement.getAttribute("gml:id") || "";
	const gemeinde = featureElement.getElementsByTagName("gis:GEMEINDE")[0]?.textContent || "";
	const bezirksArt = featureElement.getElementsByTagName("gis:BEZIRKSART")[0]?.textContent || "";
	const bezirksNummer = featureElement.getElementsByTagName("gis:BEZIRKSNUMMER")[0]?.textContent || "";

	const geometryElement = featureElement.getElementsByTagName("gis:GEOMETRY")[0];
	if (!geometryElement) {
		console.log(featureElement.innerHTML);
		throw new Error("Keine Geometrie gefunden");
	}
	let geometry: GeoJSON.Geometry;

	let polygonElement = geometryElement.getElementsByTagName("gml:Polygon")[0];
	if (polygonElement) {
		geometry = parsePolygon(polygonElement);
	} else {
		const multiSurfaceElement = geometryElement.getElementsByTagName("gml:MultiSurface")[0];
		if (multiSurfaceElement) {
			const poly = multiSurfaceElement.getElementsByTagName("gml:Polygon")[0];
			if (poly) {
				geometry = parsePolygon(poly);
			} else {
				throw new Error("Kein Polygon in MultiSurface gefunden");
			}
		} else {
			throw new Error("Unbekannter Geometrietyp");
		}
	}

	return { id, gemeinde, bezirksArt, bezirksNummer, geometry, feature: turf.feature(geometry) };
}

function parseFeatureCollection(xmlString: string, featureName: string): Feature[] {
	const xmlDoc = parse(xmlString, {
		blockTextElements: { script: true, noscript: true },
	});
	const featureNodes = xmlDoc.getElementsByTagName(featureName);
	const features: Feature[] = [];
	featureNodes.forEach((node) => {
		try {
			features.push(parseFeature(node));
		} catch (e) {
			console.error("Fehler beim Parsen eines Features:", e);
		}
	});
	return features;
}

const stimmbezirkXML = fs.readFileSync(__dirname + "/stimmbezirke.xml", "utf-8");

const bundestagswahlbezirkXML = fs.readFileSync(__dirname + "/wahlkreise.xml", "utf-8");

const stimmbezirkFeatures = parseFeatureCollection(stimmbezirkXML, "gis:skre_stimmbezirke");
const bundestagswahlFeatures = parseFeatureCollection(bundestagswahlbezirkXML, "gis:skre_bundestagswahlbezirke");

const mapping: { [stimmBezirkNr: string]: string } = {};

stimmbezirkFeatures.forEach((stimm) => {
	for (const bundestags of bundestagswahlFeatures) {
		if (turf.booleanWithin(stimm.geometry, bundestags.geometry)) {
			mapping[stimm.bezirksNummer] = bundestags.bezirksNummer;
			return;
		}
	}

	// booleanWithin didn't match, retry with overlap
	const sort = (
		bundestagswahlFeatures
			.map((bundestags) => {
				const intersection = turf.intersect(
					turf.featureCollection([stimm.feature, bundestags.feature]) as FeatureCollection<Polygon>
				);
				if (!intersection) return;

				const area = turf.area(intersection);

				return [area, bundestags.bezirksNummer] as const;
			})
			.filter(Boolean) as [number, string][]
	).sort((a, b) => b[0] - a[0]);

	if (!sort.length) throw new Error("Kein passendes Bundestagswahlbezirk gefunden");

	mapping[stimm.bezirksNummer] = sort[0][1];
});

const wahlergebnis = await csvParse({ data: fs.readFileSync(__dirname + "/wahlergebnis.csv", "utf-8"), separator: ";", skipLines: 1 });

const ids = Object.keys(mapping);

wahlergebnis.forEach((row) => {
	const { NR } = row as Record<string, string>;
	if (!NR) return;
	if (mapping[NR]) return;

	if (NR.length !== 4) throw new Error("NR ist nicht 4-stellig briefwahlbezirk");

	// console.log(NR, mapping[NR]);
	for (const id of ids) {
		const prefix = id.slice(0, 2);
		const briefWahlPrefix = NR.slice(0, 2);

		if (prefix === briefWahlPrefix) {
			mapping[NR] = mapping[id];
			return;
		}
	}
});

console.log("Mapping von Stimmbezirk auf Bundestagswahlbezirk:", mapping);

fs.writeFileSync(__dirname + "/mapping.json", JSON.stringify(mapping, null, "\t"));
