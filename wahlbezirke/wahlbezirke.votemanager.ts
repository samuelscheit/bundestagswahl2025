import { getWahlbezirkeVotemanager, getWahlbezirkVotemanager } from "./votemanager";
import { saveResults } from "./wahlbezirke";

const results = await getWahlbezirkeVotemanager();

saveResults(results);
