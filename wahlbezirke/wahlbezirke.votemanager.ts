import { getWahlbezirkeVotemanager } from "./votemanager";
import { saveResults } from "./wahlbezirke";

const results = await getWahlbezirkeVotemanager();

saveResults(results);
