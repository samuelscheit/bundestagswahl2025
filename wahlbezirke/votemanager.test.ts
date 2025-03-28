import { getWahlbezirkeVotemanager, getWahlbezirkeVotemanagerFromWahlkreise, getWahlbezirkVotemanager } from "./votemanager";
import { behoerden_queue, saveResults } from "./wahlbezirke";

const results = await getWahlbezirkVotemanager({
	bundesland: "",
	name: "",
	// url: "https://votemanager.kdo.de/03154000/",
	// url: "https://votemanager.kdo.de/031515402/",
	// url: "https://wahlen.gkd-re.net/05562000/",
	// url: "https://wahlen.wuppertal.de/05124000/",
	// url: "https://wahlen.kdvz.nrw/production/05122000/",
	// url: "https://wahlen.heidekreis.de/03358000/",
	url: "https://wahlergebnisse.komm.one/lb/produktion/08136000/",
});

await behoerden_queue.onIdle();

// const results = await getWahlbezirkeVotemanagerFromWahlkreise();

saveResults(results);
