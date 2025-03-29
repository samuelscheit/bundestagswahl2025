import { notVotemanager } from "../wahlkreise/wahlkreise";
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
	// url: "https://wahlergebnisse.komm.one/lb/produktion/08136000/",
	// url: "https://wahlergebnisse.komm.one/lb/produktion/08111000/",
	// url: "https://wahlen.stadt-koeln.de/prod/05315000/",
	// url: "https://wahlen.gkd-re.net/05562012/",
	// url: "https://wahlen.regioit.de/3/05911000/",
	// url: "https://wep.itk-rheinland.de/vm/prod/05162000/",
	// url: "https://votemanager-ks.ekom21cdn.de/06631000/",
	// url: "https://wahlen.regioit.de/4/14523320/",
	// url: "https://wahlergebnisse.komm.one/lb/produktion/08415000/",
	// url: "https://wahlergebnisse.komm.one/lb/produktion/08325000/",
	// url: "https://wahlergebnisse.komm.one/lb/produktion/08317151/",
	// url: "https://wahlergebnisse.komm.one/lb/produktion/08136000/",
	// url: "https://votemanager-ks.ekom21cdn.de/06635000/",
	// url: "https://votemanager.kdo.de/03252000/",
	// url: "https://votemanager.kdo.de/03257000/",
	// url: "https://votemanager.kdo.de/03359000/",
	// url: "https://votemanager.kdo.de/03459000/",
	// url: "https://votemanager.kdo.de/03354000/",
	// url: "https://wahlen.heidekreis.de/03358000/",
	// url: "https://votemanager.kdo.de/03405000/",
	// url: "https://votemanager.kdo.de/03405000/",
	// url: "https://votemanager.kdo.de/03352000/",
	url: "https://wahlergebnisse.komm.one/lb/produktion/08436000/",
});

await behoerden_queue.onIdle();

// const results = await getWahlbezirkeVotemanagerFromWahlkreise();

saveResults(results.filter((x: any) => x && !notVotemanager.has(Number(x.wahlkreis_id))));
