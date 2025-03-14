import { getWahlbezirkeVotemanager, getWahlbezirkeVotemanagerFromWahlkreise, getWahlbezirkVotemanager } from "./votemanager";
import { behoerden_queue, saveResults } from "./wahlbezirke";

const results = await getWahlbezirkVotemanager({
	bundesland: "",
	name: "",
	url: "https://votemanager.kdo.de/03452000/index.html",
});

await behoerden_queue.onIdle();

// const results = await getWahlbezirkeVotemanagerFromWahlkreise();

saveResults(results);
