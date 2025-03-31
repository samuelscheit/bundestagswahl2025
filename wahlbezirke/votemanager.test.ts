import { notVotemanager } from "../wahlkreise/wahlkreise";
import { getWahlbezirkVotemanager } from "./votemanager";
import { behoerden_queue, saveResults } from "./wahlbezirke";

const results = await getWahlbezirkVotemanager({
	bundesland: "",
	name: "",
	// url: "https://wep.itk-rheinland.de/vm/prod/05162000/",
	// url: "https://wep.itk-rheinland.de/vm/prod/05162016/",
	// url: "https://wahlen.gkd-re.net/05562012/",
	// url: "https://wahlen.regioit.de/3/05911000/",
	// url: "https://wep.itk-rheinland.de/vm/prod/05162016/",
	// url: "https://wahlen.salzgitter.de/ergebnisse/03102000/",
	url: "https://wahlen.regioit.de/4/14511000/index.html",
});

await behoerden_queue.onIdle();

// const results = await getWahlbezirkeVotemanagerFromWahlkreise();

saveResults(results.filter((x: any) => x && !notVotemanager.has(Number(x.wahlkreis_id))));
