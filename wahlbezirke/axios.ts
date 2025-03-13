import { buildStorage, setupCache } from "axios-cache-interceptor";
import fs from "fs";
import { join } from "path";
import Axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import { parse } from "node-html-parser";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const cacheDir = __dirname + "/cache";

if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

export function generateKey(opts: AxiosRequestConfig) {
	const url = new URL(opts.url || opts.baseURL!);

	let key = url.host.replace(":", "_") + url.pathname.replaceAll("/", "_").replace(/[^\w]/g, "") + url.search.replace(/[^\w]/g, "");
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
		validateStatus: (status) => status < 400,
		maxRedirects: 0,
	}),
	{
		headerInterpreter() {
			return 365 * 24 * 60 * 60 * 1000;
		},
		debug: console.log,
		staleIfError: false,
		cachePredicate(res) {
			return res.status < 400;
		},
		generateKey,
		storage: buildStorage({
			set(key, value, currentRequest) {
				// console.log("set cache", key);
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

import initCycleTLS, { type CycleTLSClient } from "cycletls";
import { sleep } from "bun";

let cycleTLSPromise = undefined as Promise<CycleTLSClient> | undefined;

export function isFinalError(error: Error, url = "", name = "") {
	const msg = error.message;

	if (
		msg.includes("404") ||
		msg.includes("Keine BTW25") ||
		msg.includes("Not votemanager") ||
		url.includes("wahlen.rhoen-grabfeld.de") ||
		name === "Salzgitter" ||
		name === "Verwaltungsgemeinschaft Kirchehrenbach" ||
		name === "Veitshöchheim" ||
		name === "Kirchehrenbach" ||
		name === "Hebertshausen" ||
		name === "Ihrlerstein" ||
		name === "Bogen" ||
		name === "Höchberg" ||
		name === "Schiffweiler" ||
		name === "Veitshöchheim"
	) {
		return true;
	}

	return false;
}

export async function cycleFetch(url: string, opts: AxiosRequestConfig) {
	var cacheFile = __dirname + "/cache/" + generateKey({ url });
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
			ja3: "772,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,5-13-10-16-18-43-0-65281-27-45-11-51-35-23-65037,4588-29-23-24,0",
		},
		"get"
	);

	if (response.status >= 500 || response.status < 200) throw new Error(`Request failed with status code ${response.status} `);

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

export async function axiosWithRedirect<T = any, D = any>(
	url: string,
	opts: AxiosRequestConfig & { tries?: number; error?: string } = {}
): Promise<AxiosResponse<T, D> & { cached?: boolean; url: string }> {
	if (opts.tries && opts.tries > 5) throw new Error("Too many tries: " + url + " " + opts.error);
	opts.tries = (opts.tries || 0) + 1;

	try {
		if (url.includes("wahlen-muenchen.de") || url.includes("wahlen-sh.de")) {
			return await cycleFetch(url, opts);
		}
		if (url.includes("saarland.de")) {
			var response = await Axios(url, opts);
		} else {
			var response = await axios(url, opts);
		}
	} catch (error) {
		const msg = (error as Error).message;
		console.error("Request failed, retrying ...", url, msg);

		if (isFinalError(error as Error)) {
			throw error;
		} else if (msg.includes("JSON Parse error")) {
			fs.unlinkSync(__dirname + "/cache/" + generateKey({ ...opts, url }));
		} else {
			await sleep(2000);
		}

		opts.error = msg;

		return axiosWithRedirect(url, opts);
	}

	if (response.headers["location"]) {
		const newUrl = response.headers["location"];
		console.log("Redirect", url, newUrl);
		if (newUrl.includes("x-myracloud-")) {
			try {
				fs.unlinkSync(__dirname + "/cache/" + generateKey({ ...opts, url }));
			} catch (error) {}

			throw new Error("Myracloud error: " + url);
		}

		return axiosWithRedirect(newUrl, opts);
	} else if (response.data?.includes?.(`http-equiv="refresh"`)) {
		const root = parse(response.data);
		const meta = root.querySelector("meta[http-equiv='refresh']");
		const content = meta?.getAttribute("content")?.split(";")?.[1];
		let [_, newUrl] = content?.split("=") || [];

		if (newUrl) {
			if (newUrl.startsWith("'") && newUrl.endsWith("'")) {
				newUrl = newUrl.slice(1, -1);
			}
			console.log("Refresh", newUrl);
			return axiosWithRedirect(newUrl, opts);
		}
	}

	return { ...response, url };
}
