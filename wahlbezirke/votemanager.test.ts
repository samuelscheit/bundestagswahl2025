import { getWahlbezirkeVotemanager, getWahlbezirkVotemanager } from "./votemanager";
import { saveResults } from "./wahlbezirke";

const results = await getWahlbezirkVotemanager({
	bundesland: "",
	name: "",
	url: "https://wahlen.kdvz.nrw/production/05978028/index.html",
});

saveResults([results[0], results[0]]);
