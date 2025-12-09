import { readFileSync } from "fs";
import { ElectionMap } from "./Map";

export default function Page() {
	const data = JSON.parse(readFileSync(process.cwd() + "/2025_NRW_Kommunalwahlen/result.json", "utf-8"));

	return <ElectionMap data={data} />;
}
