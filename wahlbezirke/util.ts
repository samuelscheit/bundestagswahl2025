import parse from "csv-parser";
import type { Options } from "csv-parser";

export async function csvParse({ data, ...opts }: Options & { data: string }) {
	const stream = parse({
		separator: ";",
		...opts,
	});

	const result = [] as any[];

	stream.on("data", (data) => {
		result.push(data);
	});
	stream.write(data);
	stream.end();

	await new Promise((resolve) => {
		stream.on("end", () => {
			resolve(null);
		});
	});

	return result;
}

export function assignOptional(obj: Record<string, any>, patch: Record<string, any>) {
	for (const key in patch) {
		if (obj[key] == undefined) {
			obj[key] = patch[key];
		}
	}
}
