import { getWahlbezirk, getWahlbezirkeVotemanager } from "./wahlbezirke";
import fs from "fs";

// @ts-ignore
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

process.on("unhandledRejection", (error) => {
	console.error(error);
});

process.on("uncaughtException", (error) => {
	console.error(error);
});

const result = await getWahlbezirkeVotemanager();
// const result = await getWahlbezirk({ name: "", url: "https://wahlen.kdvz.nrw/production/05962004/", bundesland: "" });

console.log(result);

fs.writeFileSync(__dirname + "/data/wahlbezirke.json", JSON.stringify(result, null, "\t"));
