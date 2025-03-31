import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { defaultResult, ResultType } from "../../wahlkreise/scrape";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export async function getParams(params: Promise<any>) {
	const result = await params;

	var { bundesland, region, kreis, verband, gemeinde, wahlkreis } = result;

	if (bundesland === "null") bundesland = null;
	if (region === "null") region = null;
	if (kreis === "null") kreis = null;
	if (verband === "null") verband = null;
	if (gemeinde === "null") gemeinde = null;
	if (wahlkreis === "null") wahlkreis = null;

	return {
		bundesland,
		kreis,
		verband,
		gemeinde,
		wahlkreis,
		region,
	};
}
