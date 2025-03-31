import { notVotemanager } from "../wahlkreise/wahlkreise";
import { getWahlbezirkeVotemanager, getWahlbezirkeVotemanagerFromWahlkreise, getWahlbezirkVotemanager } from "./votemanager";
import { behoerden_queue, bundesland_queue, saveResults } from "./wahlbezirke";

const results = await bundesland_queue.addAll(
	[
		"https://votemanager.kdo.de/03154000/",
		"https://votemanager.kdo.de/031515402/",
		"https://wahlen.gkd-re.net/05562000/",
		"https://wahlen.wuppertal.de/05124000/",
		"https://wahlen.kdvz.nrw/production/05122000/",
		"https://wahlergebnisse.komm.one/lb/produktion/08136000/",
		"https://wahlergebnisse.komm.one/lb/produktion/08111000/",
		"https://wahlen.stadt-koeln.de/prod/05315000/",
		"https://wahlen.gkd-re.net/05562012/",
		"https://wahlen.regioit.de/3/05911000/",
		"https://wep.itk-rheinland.de/vm/prod/05162000/",
		"https://votemanager-ks.ekom21cdn.de/06631000/",
		"https://wahlen.regioit.de/4/14523320/",
		"https://wahlergebnisse.komm.one/lb/produktion/08415000/",
		"https://wahlergebnisse.komm.one/lb/produktion/08325000/",
		"https://wahlergebnisse.komm.one/lb/produktion/08317151/",
		"https://wahlergebnisse.komm.one/lb/produktion/08136000/",
		"https://votemanager-ks.ekom21cdn.de/06635000/",
		"https://votemanager.kdo.de/03252000/",
		"https://votemanager.kdo.de/03257000/",
		"https://votemanager.kdo.de/03359000/",
		"https://votemanager.kdo.de/03459000/",
		"https://votemanager.kdo.de/03354000/",
		"https://wahlen.heidekreis.de/03358000/",
		"https://votemanager.kdo.de/03405000/",
		"https://votemanager.kdo.de/03405000/",
		"https://votemanager.kdo.de/03352000/",
		"https://wahlergebnisse.komm.one/lb/produktion/08436000/",
		"https://wahlvote.voelklingen.de/produktion/10041519/index.html",
		"https://wahlen.ego-saar.de/vm_prod/prod/10045000/index.html",
		"https://wahlen.neunkirchen.de/",
		"https://www.quierschied.de/fileadmin/vote-iT/Produktiv/10041516/index.html",
		"https://wahlen.heidekreis.de/03358000/",
		"https://wahlen.gkd-re.net/05562012/",
		"https://wahlen.regioit.de/3/05911000/",
		"https://wahlen.regioit.de/4/14627140/",
		"https://wahlen.regioit.de/4/14523320/",
		"https://wahlen.gkd-re.net/05562012/",
		"https://wahlen.regioit.de/3/05911000/",
		"https://wahlen.salzgitter.de/ergebnisse/03102000/",
	].map(
		(x) => () =>
			getWahlbezirkVotemanager({
				bundesland: "",
				name: "",
				url: x,
			}).catch(console.error)
	)
);

await behoerden_queue.onIdle();

// const results = await getWahlbezirkeVotemanagerFromWahlkreise();

saveResults(results[0].filter((x: any) => x && !notVotemanager.has(Number(x.wahlkreis_id))));
