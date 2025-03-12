import type { ResultType } from "./scrape";
import fs from "fs";
import { landWahlkreise, wahlkreiseQuellen } from "./wahlkreise";
import { getWahlbezirk, getWahlbezirkeVotemanager } from "./votemanager";
import { getIdFromResult, saveResults } from "./wahlbezirke";
import { getWahlbezirkeWAS } from "./WAS";

// @ts-ignore

// const results = [] as ResultType[];
// const results = (await getWahlbezirk({ name: "", url: "https://votemanager.kdo.de/15084315/index.html", bundesland: "" }))!;
// const bayern = landWahlkreise["9"].map((x) => (wahlkreiseQuellen as any)[x]);
// const result = await getWahlbezirkeWAS(bayern);
// const brandenburg = landWahlkreise["12"].map((x) => (wahlkreiseQuellen as any)[x]);

// München
// const results = await getWahlbezirkeWAS([
// wahlkreiseQuellen["216"],
// wahlkreiseQuellen["217"],
// wahlkreiseQuellen["218"],
// wahlkreiseQuellen["219"],
// ]);

// const results = await getWahlbezirkeWAS([wahlkreiseQuellen["54"]]);

// const results = await getWahlbezirkeVotemanager();

// saveResults(results);
