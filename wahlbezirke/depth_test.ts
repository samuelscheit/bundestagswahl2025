import type { ResultType } from "../wahlkreise/scrape";

const x = require("./data/wahlbezirke.json");

interface T {
	[key: string]: T | ResultType;
}
function getDepth(obj: T, path: string[] = []): { depth: number; path: string[] } {
	let maxDepth = 0;
	let maxPath: string[] = path;

	for (const [key, value] of Object.entries(obj)) {
		if (typeof value === "object" && value !== null && !("erststimmen" in value)) {
			const { depth, path: subPath } = getDepth(value as T, [...path, key]);
			if (depth > maxDepth) {
				maxDepth = depth;
				maxPath = subPath;
			}
		}
	}

	return { depth: maxDepth + 1, path: maxPath };
}

console.log(getDepth(x));
