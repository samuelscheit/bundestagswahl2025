"use client";

import { useLayoutEffect, useRef } from "react";
import type { ResultType } from "@/../wahlkreise/scrape";
import { ColorSpecification, LayerSpecification, Map } from "maplibre-gl";
import ScrollShadow from "../components/scrollshadow";

const parteien = [
	"CSU",
	"CDU",
	"SPD",
	"GRÜNE",
	"FDP",
	"AfD",
	"FREIE WÄHLER",
	"Die Linke",
	"dieBasis",
	"Tierschutzpartei",
	"Die PARTEI",
	"ÖDP",
	"BP",
	"Volt",
	"PdH",
	"MLPD",
	"BÜNDNIS DEUTSCHLAND",
	"BSW",
];

const parteienSelection = [
	"Union",
	"SPD",
	"GRÜNE",
	"FDP",
	"AfD",
	"Die Linke",
	"BSW",
	"FREIE WÄHLER",
	"Volt",
	"dieBasis",
	"Tierschutzpartei",
	"Die PARTEI",
	"ÖDP",
	"BP",
	"PdH",
	"MLPD",
	"BÜNDNIS DEUTSCHLAND",
];

const parteienFarben = {
	CDU: "#000000",
	CSU: "#000000",
	SPD: "#E7000F",
	GRÜNE: "#46962b",
	FDP: "#FFEF00",
	AfD: "#0489DB",
	"FREIE WÄHLER": "#f49c14",
	"Die Linke": "#ff00ea",
	dieBasis: "#FF7F00",
	Tierschutzpartei: "#A80000",
	"Die PARTEI": "#B92837",
	ÖDP: "#EE7100",
	BP: "#0080FF",
	Volt: "#502379",
	PdH: "#A80000",
	MLPD: "#ED0008",
	"BÜNDNIS DEUTSCHLAND": "#FF7F00",
	BSW: "#731032",
};

const parteienMax = {
	Union: 45,
	SPD: 33,
	GRÜNE: 23,
	FDP: 8,
	AfD: 50,
	"Die Linke": 23,
	BSW: 14,
	"FREIE WÄHLER": 13,
	Volt: 2.5,
	dieBasis: 1,
	Tierschutzpartei: 4,
	"Die PARTEI": 2.5,
	ÖDP: 1,
	BP: 1,
	PdH: 0.3,
	MLPD: 0.3,
	"BÜNDNIS DEUTSCHLAND": 0.8,
} as Record<string, number>;

const parteienFarbenSaturation = {
	Union: 10,
	SPD: 70,
	GRÜNE: 50,
	FDP: 40,
	AfD: 100,
	"FREIE WÄHLER": 90,
	"Die Linke": 50,
	dieBasis: 100,
	Tierschutzpartei: 100,
	"Die PARTEI": 100,
	ÖDP: 100,
	BP: 100,
	Volt: 100,
	PdH: 80,
	MLPD: 80,
	"BÜNDNIS DEUTSCHLAND": 100,
	BSW: 80,
} as Record<string, number>;

function getParteiFillColor(partei: string, saturation = 100) {
	// @ts-ignore
	return getParteiLayer(partei, saturation).paint["fill-color"] as ColorSpecification;
}

function alleParteien() {
	return {
		id: "gemeinde:fill",
		type: "fill",
		source: "map",
		"source-layer": "gemeinde",
		paint: {
			"fill-color": [
				"match",
				["get", "leading_party"],
				"SPD",
				getParteiFillColor("SPD"),
				"CDU",
				getParteiFillColor("Union", 10),
				"CSU",
				getParteiFillColor("Union", 10),
				"GRÜNE",
				getParteiFillColor("GRÜNE"),
				"FDP",
				getParteiFillColor("FDP"),
				"AfD",
				getParteiFillColor("AfD"),
				"Die Linke",
				getParteiFillColor("Die Linke"),
				"BSW",
				getParteiFillColor("BSW"),
				"FREIE WÄHLER",
				getParteiFillColor("FREIE WÄHLER"),
				"#ffffff",
			],
			"fill-opacity": 1,
		},
	} as LayerSpecification;
}

const labelStyle: any = {
	"source-layer": "place",
	type: "symbol",
	source: "map",
	layout: {
		"text-field": "{name:latin}",
		"text-font": ["noto_sans_regular"],
		"text-transform": "uppercase",
		"text-anchor": "top",
		"text-offset": [0, 0.2],
		"text-padding": 0,
		"text-letter-spacing": 0.05,
		"text-optional": true,
		"text-size": {
			stops: [
				[5, 8],
				[8, 12],
			],
		},
	},
	paint: {
		"icon-color": "rgb(61,61,77)",
		"text-color": "#fff",
		"text-halo-color": "rgba(0,0,0,0.5)",
		"text-halo-width": 1,
		"text-halo-blur": 0,
	},
};

export function ElectionMap() {
	const ref = useRef<HTMLDivElement>(null);
	const mapRef = useRef<Map | null>(null);
	const parteiSelected = useRef<string | null>(null);

	useLayoutEffect(() => {
		const endpoint = globalThis?.location.hostname === "localhost" ? "http://localhost:8080" : `${globalThis?.location.origin}/map`;

		var map = new Map({
			container: "map",
			// style: "https://demotiles.maplibre.org/style.json", // stylesheet location
			// center: [11.45, 48.1],
			// zoom: 8, // starting zoom
			// bounds: shape?.geometry?.bbox as any,
			// style: {
			// 	layers: [],
			// 	version: 8,
			// 	sources: {},
			// },
			// style: "https://tiles.versatiles.org/assets/styles/neutrino/style.json",
			// style,
			center: [10, 51.35], // Deutschland
			zoom: 5.7,
			// minZoom: 11,
			style: {
				glyphs: "https://versatiles.org/versatiles-glyphs-rs/assets/glyphs/{fontstack}/{range}.pbf",
				version: 8,
				sources: {
					map: {
						type: "vector",
						tiles: [
							`${endpoint}/data/map/{z}/{x}/{y}.pbf`,
							// "https://tiles.versatiles.org/assets/styles/neutrino/tiles/{z}/{x}/{y}.pbf",
						],
						minzoom: 0,
						maxzoom: 8,
					},
				},
				layers: [
					{
						id: "background",
						type: "background",
						paint: {
							"background-color": "#f0f0f0",
						},
					},
					parteiSelected.current ? getParteiLayer(parteiSelected.current) : alleParteien(),
					{
						id: "bundesland:line",
						type: "line",
						source: "map",
						"source-layer": "bundesland",
						paint: {
							"line-color": "#000000",
							"line-width": {
								type: "exponential",
								stops: [
									[5.8, 0],
									[5.9, 0.5],
									[8, 1],
								] as const,
							},
						},
						// minzoom: 6,
					},
					{
						id: "gemeinde:outline",
						type: "line",
						source: "map",
						"source-layer": "gemeinde",
						paint: {
							"line-color": "#000000",
							"line-width": 0.001,
							"line-opacity": 0.2,
						},
					},
					{
						...labelStyle,
						id: "label-boundary-state",
						filter: ["all", ["==", "class", "state"]],
						minzoom: 5.8,
						layout: {
							...labelStyle.layout,
							"text-size": 12,
						},
					},
					{
						...labelStyle,
						id: "label-cities",
						filter: ["<", "rank", 9],
						minzoom: 7,
						maxzoom: 10,
					},
					{
						...labelStyle,
						id: "label-towns",
						"source-layer": "gemeinde",
						minzoom: 10,
						layout: {
							...labelStyle.layout,
							"text-field": "{name}",
						},
					},
				],
			},
		});

		mapRef.current = map;

		let currentGemeinde = null as string | null;

		map.on("mousemove", "gemeinde:fill", (e) => {
			if (e.features?.length === 0) return;
			if (!ref.current) return;

			const feature = e.features![0];
			if (!feature.properties) return;

			const properties = feature.properties;

			ref.current.style.top = e.point.y + "px";
			ref.current.style.left = e.point.x + "px";

			if (currentGemeinde === properties.name) return;

			currentGemeinde = properties.name;

			let name = properties.name;

			if (properties.verband_name) name = name + " (" + properties.verband_name + ")";

			const parteien_results = parteien
				.map((x) => {
					return {
						name: x,
						value: properties[x],
					};
				})
				.filter((x) => x.value !== undefined);

			const result = parteien_results
				.filter((x) => x.value > 2 || parteiSelected.current === x.name)
				.sort((a, b) => b.value - a.value)
				.map((x) => {
					const value = parteiSelected.current === x.name ? (x.value || 0).toFixed(2) : (x.value || 0).toFixed(0);

					return `<div class="flex justify-between gap-6">

						<div class="flex items-center gap-2">
							<div style="background: ${(parteienFarben as any)[x.name]}" class="size-3 rounded-4xl border-[0.1pt] border-white" ></div>
							<div class="font-bold">${x.name}</div>
						</div>
						<span class="font-bold">${value}%</span>
					</div>`;
				});

			const description = parteien_results.length === 0 ? `<span class="text-xs">Gemeindefreies Gebiet</span>` : result.join("");

			ref.current.style.visibility = "visible";
			ref.current.innerHTML = `<div class="flex flex-col gap-2">
					<div class="text-center font-bold">${name}</div>
					<div>
						${description}
					</div>
				</div>`;
		});

		map.on("mousemove", "label-boundary-state", (e) => {
			console.log(e.features?.[0]);
		});

		// @ts-ignore
		globalThis.map = map;

		map.on("mouseleave", "gemeinde:fill", () => {
			if (!ref.current) return;
			ref.current.style.visibility = "hidden";
		});

		map.on("load", () => {
			console.log(map.getLayersOrder());

			map.getLayersOrder().forEach((x) => {
				const layer = map.getLayer(x);
				if (!layer) return;
			});
		});

		return () => {
			map.remove();
		};
	}, [Math.random()]);

	return (
		<div className="">
			<div className="absolute top-0 left-0 p-4">
				<div className="bg-background rounded-xl p-2 ">
					<div className="max-sm:hidden text-sm font-bold px-2 pb-2 text-center w-full">Parteien</div>
					<ScrollShadow className="max-sm:[mask-image:none] sm:max-h-[30vh] md:max-h-[50vh] max-h-[10vh] overflow-y-scroll no-scrollbar flex flex-col gap-1">
						<PartySelection
							value="Alle"
							defaultChecked
							onChange={() => {
								const map = mapRef.current;
								if (!map) return;

								parteiSelected.current = null;

								if (map.getLayer("gemeinde:fill")) map.removeLayer("gemeinde:fill");
								map.addLayer(alleParteien(), "bundesland:line");
							}}
						/>
						{parteienSelection.map((x) => (
							<PartySelection
								key={x}
								value={x}
								onChange={() => {
									const map = mapRef.current;
									if (!map) return;

									parteiSelected.current = x;

									if (map.getLayer("gemeinde:fill")) map.removeLayer("gemeinde:fill");
									map.addLayer(getParteiLayer(x), "bundesland:line");
								}}
							/>
						))}
					</ScrollShadow>
				</div>
			</div>
			<div
				style={{ visibility: "hidden" }}
				className="absolute text-white pointer-events-none m-2 p-3 bg-black rounded-xl max-sm:text-xs text-sm"
				ref={ref}
			></div>
			<div id="map" className="w-full h-screen cursor-pointer"></div>
		</div>
	);
}

function PartySelection({
	value,
	defaultChecked,
	onChange,
}: {
	value: string;
	defaultChecked?: boolean;
	onChange?: (value: string) => void;
}) {
	return (
		<div>
			<input
				onChange={(e) => {
					console.log(e.target.checked, value);
					onChange?.(value);
				}}
				defaultChecked={defaultChecked}
				id={value}
				type="radio"
				name="partei"
				className="hidden peer"
			/>
			<label
				htmlFor={value}
				className="px-2 py-1 text-xs rounded hover:bg-gray-100 peer-checked:bg-gray-200! flex items-center text-sm font-medium text-gray-900 dark:text-gray-300 peer-checked:font-bold cursor-pointer"
			>
				{value}
			</label>
		</div>
	);
}

function getParteiLayer(partei: string, overrideSaturation?: number) {
	const colors = [] as (string | number)[];

	const isUnion = partei === "Union";

	let parteiColor = (parteienFarben as any)[partei] || "#000000";

	function interpolate(input: number, min: number, max: number, minOut: number, maxOut: number) {
		return ((input - min) / (max - min)) * (maxOut - minOut) + minOut;
	}
	const max = parteienMax[partei] || 100;
	const steps = max / 50;
	const saturation = overrideSaturation || parteienFarbenSaturation[partei] || 100;

	for (let i = 0; i < max; i += steps) {
		const out = 100 - interpolate(i, 0, max, 0, 80);

		let lightness = out;
		console.log(lightness, i, out, max);
		colors.push(generateColorVariant(parteiColor, lightness, saturation));
		colors.push(i);
	}

	let get: any = ["coalesce", ["get", partei], 0];
	if (isUnion) get = ["coalesce", ["get", "CDU"], ["coalesce", ["get", "CSU"], 0]];

	return {
		id: "gemeinde:fill",
		type: "fill",
		source: "map",
		"source-layer": "gemeinde",
		paint: {
			"fill-color": [
				"step",
				get,
				...colors.slice(0, colors.length - 1),
				//
			],
			"fill-opacity": 1,
		},
	} as LayerSpecification;
}

function generateColorVariant(baseColor: string, lightness: number, saturation: number) {
	// For black (CDU/CSU), we need to use gray tones
	if (baseColor === "#000000") {
		return `hsl(0, 0%, ${lightness + -saturation}%)`;
	}

	// Convert hex to RGB
	let r = parseInt(baseColor.slice(1, 3), 16);
	let g = parseInt(baseColor.slice(3, 5), 16);
	let b = parseInt(baseColor.slice(5, 7), 16);

	// Convert RGB to HSL
	r /= 255;
	g /= 255;
	b /= 255;

	let max = Math.max(r, g, b);
	let min = Math.min(r, g, b);
	let h = 0,
		s,
		l = (max + min) / 2;

	if (max === min) {
		h = s = 0; // achromatic
	} else {
		let d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}

		h /= 6;
	}

	// Adjust saturation and lightness
	s = saturation / 100;
	l = lightness / 100;

	// Convert back to RGB
	let r1, g1, b1;

	if (s === 0) {
		r1 = g1 = b1 = l; // achromatic
	} else {
		const hue2rgb = (p: number, q: number, t: number) => {
			if (t < 0) t += 1;
			if (t > 1) t -= 1;
			if (t < 1 / 6) return p + (q - p) * 6 * t;
			if (t < 1 / 2) return q;
			if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
			return p;
		};

		let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		let p = 2 * l - q;

		r1 = hue2rgb(p, q, h + 1 / 3);
		g1 = hue2rgb(p, q, h);
		b1 = hue2rgb(p, q, h - 1 / 3);
	}

	// Convert RGB back to hex
	const toHex = (x: number) => {
		const hex = Math.round(x * 255).toString(16);
		return hex.length === 1 ? "0" + hex : hex;
	};

	return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}
