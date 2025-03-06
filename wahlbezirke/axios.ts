import { buildStorage, setupCache } from "axios-cache-interceptor";
import fs from "fs";
import { join } from "path";
import Axios, { type AxiosRequestConfig } from "axios";

const cacheDir = __dirname + "/cache";

if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

export function generateKey(opts: AxiosRequestConfig) {
	const url = new URL(opts.url || opts.baseURL!);

	let key = url.host.replace(":", "_") + url.pathname.replace(/[^\w]/g, "");
	if (url.protocol !== "https:") key = "http_" + key;

	return key;
}

export const axios = setupCache(
	Axios.create({
		headers: {
			accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
			"accept-language": "en-US,en;q=0.9,de-DE;q=0.8,de;q=0.7",
			"cache-control": "no-cache",
			dnt: "1",
			pragma: "no-cache",
			priority: "u=0, i",
			"Sec-Ch-Ua-Arch": '"arm"',
			"Sec-Ch-Ua-Bitness": '"64"',
			"Sec-Ch-Ua-Full-Version-List": '"Not(A:Brand";v="99.0.0.0", "Google Chrome";v="133.0.6943.142", "Chromium";v="133.0.6943.142"',
			"Sec-Ch-Ua-Mobile": "?0",
			"Sec-Ch-Ua-Model": '""',
			"Sec-Ch-Ua-Platform": '"macOS"',
			"Sec-Ch-Ua-Platform-Version": '"15.3.1"',
			"Sec-Ch-Ua-Wow64": "?0",
			"Sec-Fetch-Dest": "document",
			"Sec-Fetch-Mode": "navigate",
			"Sec-Fetch-Site": "same-origin",
			"Sec-Fetch-User": "?1",
			"upgrade-insecure-requests": "1",
			"user-agent":
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
		generateKey,
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

import initCycleTLS from "cycletls";

let cycleTLSPromise = undefined as Promise<any> | undefined;

export async function cycleFetch(url: string, opts: AxiosRequestConfig) {
	var cacheFile = __dirname + "/cache/" + generateKey({ url });
	console.log("cacheFile", cacheFile);
	if (fs.existsSync(cacheFile)) {
		const { data } = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
		return {
			url,
			data: data.data,
			headers: data.headers,
			status: data.status,
			statusText: "",
			config: {} as any,
			cached: true,
		};
	}

	if (!cycleTLSPromise) cycleTLSPromise = initCycleTLS();

	const cycleTLS = await cycleTLSPromise;

	const headers: any = { ...axios.defaults.headers };
	delete headers.common;
	delete headers.get;
	delete headers.head;
	delete headers.post;
	delete headers.put;
	delete headers.patch;
	delete headers.delete;

	const response = await cycleTLS(
		url,
		{
			headers: headers,
			userAgent: headers["user-agent"] as string,
		},
		"get"
	);

	if (response.status >= 400) throw new Error(`Request failed with status code ${response.status}`);

	fs.writeFileSync(
		__dirname + "/cache/" + generateKey({ url }),
		JSON.stringify({
			state: "cached",
			ttl: 31536000000,
			createdAt: Date.now(),
			data: {
				data: response.body,
				status: response.status,
				statusText: "",
				headers: response.headers,
			},
		})
	);

	return {
		url,
		data: response.body as any,
		headers: response.headers,
		status: response.status,
		statusText: "",
		config: {} as any,
	};
}
