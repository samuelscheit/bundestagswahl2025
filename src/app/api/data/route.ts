import { readFileSync } from "fs"

export function GET() {
	const x = JSON.parse(readFileSync(process.cwd()  + "/2025_NRW_Kommunalwahlen/result.json", "utf-8"))

	return Response.json(x)
}

