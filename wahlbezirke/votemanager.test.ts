import { getWahlbezirkeVotemanager, getWahlbezirkeVotemanagerFromWahlkreise, getWahlbezirkVotemanager } from "./votemanager";
import { behoerden_queue, saveResults } from "./wahlbezirke";

const results = await getWahlbezirkVotemanager({
	bundesland: "",
	name: "",
	url: "https://wahlergebnisse.komm.one/lb/produktion/08235000/",
});

await behoerden_queue.onIdle();

// const results = await getWahlbezirkeVotemanagerFromWahlkreise();

saveResults(results);
