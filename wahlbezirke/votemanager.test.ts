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
	// url: "https://wahlergebnisse.komm.one/lb/produktion/08136000/",
	// url: "https://wahlergebnisse.komm.one/lb/produktion/08111000/",
	// url: "https://wahlen.stadt-koeln.de/prod/05315000/",
	// url: "https://wahlen.gkd-re.net/05562012/",
	// url: "https://wahlen.regioit.de/3/05911000/",
	// url: "https://wep.itk-rheinland.de/vm/prod/05162000/",
	url: "https://votemanager-ks.ekom21cdn.de/06631000/",
});

await behoerden_queue.onIdle();

// const results = await getWahlbezirkeVotemanagerFromWahlkreise();

saveResults(results);
