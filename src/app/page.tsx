import type { ResultType } from "../../wahlkreise/scrape";
import { Search } from "./Search";
const list = require("../../wahlbezirke/data/wahlbezirkeList.json") as ResultType[];

const gemeinden = [...new Set(list.map((gemeinde) => gemeinde.gemeinde_name))].filter(Boolean);

export default function Home() {
	return <Search data={gemeinden} />;
}
