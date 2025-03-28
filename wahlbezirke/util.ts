import parse from "csv-parser";
import type { Options } from "csv-parser";

export async function csvParse({ data, ...opts }: Options & { data: string }) {
	const stream = parse({
		separator: ";",
	});

	const result = [] as any[];

	stream.on("data", (data) => {
		result.push(data);
	});
	stream.write(data);
	stream.end();

	await new Promise((resolve) => {
		stream.on("end", () => {
			resolve();
		});
	});

	return result;
}
