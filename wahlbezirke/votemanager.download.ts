import type { ResultType } from "../wahlkreise/scrape";
import { notVotemanager } from "../wahlkreise/wahlkreise";
import { getWahlbezirkeVotemanagerFromWahlkreise, getWahlbezirkVotemanager } from "./votemanager";
import { behoerden_queue, saveResults } from "./wahlbezirke";

// const results1 = getWahlbezirkeVotemanager();
const results1 = [] as any[];
const results2 = getWahlbezirkeVotemanagerFromWahlkreise();

const additional = [
	"https://wahlvote.voelklingen.de/produktion/10041519/index.html",
	"https://wahlen.ego-saar.de/vm_prod/prod/10045000/index.html",
	"https://wahlen.neunkirchen.de/",
	"https://www.quierschied.de/fileadmin/vote-iT/Produktiv/10041516/index.html",
].map((x) =>
	getWahlbezirkVotemanager({
		bundesland: "",
		name: "",
		url: x,
	}).catch(console.error)
);

const results = await Promise.all([results1, results2, ...additional]);
await behoerden_queue.onIdle();

saveResults(results.flat().filter((x) => x && !notVotemanager.has(Number(x.wahlkreis_id))) as ResultType[]);
