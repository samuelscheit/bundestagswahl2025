import { buildStorage, setupCache } from "axios-cache-interceptor";
import fs from "fs";
import { join } from "path";
import Axios from "axios";

const cacheDir = __dirname + "/cache";

if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

export const axios = setupCache(
	Axios.create({
		headers: {
			accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
			"accept-language": "en-US,en;q=0.9,de-DE;q=0.8,de;q=0.7",
			"sec-ch-ua": '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
			"sec-ch-ua-mobile": "?0",
			"sec-ch-ua-platform": '"macOS"',
			"sec-fetch-dest": "document",
			"sec-fetch-mode": "navigate",
			"sec-fetch-site": "none",
			"upgrade-insecure-requests": "1",
			"User-Agent":
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
		},
		responseType: "json",
		validateStatus: (status) => status < 500,
		maxRedirects: 0,
	}),
	{
		headerInterpreter() {
			return 365 * 24 * 60 * 60 * 1000;
		},
		debug: console.log,
		staleIfError: false,
		cachePredicate(res) {
			return res.status < 500;
		},
		generateKey(opts) {
			const url = new URL(opts.url || opts.baseURL!);

			let key = url.host.replace(":", "_") + url.pathname.replace(/[^\w]/g, "");
			if (url.protocol !== "https:") key = "http_" + key;

			return key;
		},
		storage: buildStorage({
			set(key, value, currentRequest) {
				console.log("set cache", key);
				fs.writeFileSync(join(cacheDir, key), JSON.stringify(value));
			},
			find(key, currentRequest) {
				if (!fs.existsSync(join(cacheDir, key))) return null;

				const result = fs.readFileSync(join(cacheDir, key), "utf-8");
				return JSON.parse(result);
			},
			remove(key, currentRequest) {
				// console.log("remove cache", key);
				// fs.unlinkSync(join(cacheDir, key));
			},
			clear() {
				console.log("clear");
				fs.rmdirSync(cacheDir, { recursive: true });
				fs.mkdirSync(cacheDir);
			},
		}),
	}
);
