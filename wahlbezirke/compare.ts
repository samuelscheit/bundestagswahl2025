import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { type ResultType } from "../wahlkreise/scrape";
import { wahlkreiseNamen } from "../wahlkreise/wahlkreise";

/**
 * Normalises text for consistent comparison
 */
function normaliseText(text: string): string {
	if (!text) return "";
	return text
		.trim()
		.toLowerCase()
		.replace(/\s+/g, " ")
		.replace(/[-,.()\[\]]/g, "");
}

/**
 * Compares electoral district data with official CSV results
 */
function compareWithCSVResults(csvFilePath: string, nameColumn: string, votersColumn: string, wahlkreisId: string): void {
	const resolvedPath = path.resolve(csvFilePath);

	if (!fs.existsSync(resolvedPath)) {
		console.error(`Error: CSV file not found at ${resolvedPath}`);
		return;
	}

	try {
		// Read and parse CSV file
		const csvContent = fs.readFileSync(resolvedPath, "utf8");
		const records = parse(csvContent, {
			columns: true,
			skip_empty_lines: true,
			trim: true,
			delimiter: ";",
			relax_column_count: true,
		});

		// Load wahlbezirke data
		const wahlbezirke = require("./data/wahlbezirkeList.json") as ResultType[];

		// Filter by wahlkreis ID
		const bezirke = wahlbezirke.filter((x) => {
			if (!x.wahlkreis_id) return false;
			return parseInt(x.wahlkreis_id).toString() === wahlkreisId;
		});

		if (bezirke.length === 0) {
			console.error(`No electoral districts found for Constituency ${wahlkreisId}`);
			return;
		}

		console.log(`Analysing Constituency ${wahlkreisId} (${wahlkreiseNamen[wahlkreisId]}):`);
		console.log("--------------------");

		// Process CSV data - creating a map where each record exists only once
		const csvRecords = new Map<number, { name: string; voters: number; matched: boolean }>();

		for (let i = 0; i < records.length; i++) {
			const record = records[i];
			if (!record[nameColumn]) continue;

			const name = record[nameColumn].trim();
			const voters = parseInt(record[votersColumn], 10);

			if (name && !isNaN(voters)) {
				csvRecords.set(i, { name, voters, matched: false, record });
			}
		}

		// Create lookup map for normalized names to original CSV record indices
		const csvLookup = new Map<string, number[]>();

		for (const [idx, record] of csvRecords.entries()) {
			const normName = normaliseText(record.name);
			if (!csvLookup.has(normName)) {
				csvLookup.set(normName, []);
			}
			csvLookup.get(normName).push(idx);

			// Also add ID pattern if present
			const idMatch = record.name.match(/^(\d{3}-\d{2})/);
			if (idMatch) {
				const idNorm = normaliseText(idMatch[1]);
				if (!csvLookup.has(idNorm)) {
					csvLookup.set(idNorm, []);
				}
				csvLookup.get(idNorm).push(idx);
			}
		}

		// Compare with wahlbezirke data
		const mismatches = [];
		const matchDetails = new Map<string, string>();
		const missingInCSV = [];
		let totalSourceVoters = 0;

		// Check if wahlbezirke are in CSV
		for (const bezirk of bezirke) {
			totalSourceVoters += bezirk.anzahl_wähler || 0;

			const bezirkName = bezirk.wahlbezirk_name || bezirk.wahlbezirk_id || "";
			const gemeindeName = bezirk.gemeinde_name || "";
			const bezirkFull = `${bezirkName}${gemeindeName ? ` (${gemeindeName})` : ""}`;

			// Try different combinations for matching
			const possibleNames = [
				normaliseText(bezirkName),
				// Add just the ID part if it matches the pattern
				...(bezirkName.match(/^(\d{3}-\d{2})/) ? [normaliseText(bezirkName.match(/^(\d{3}-\d{2})/)[1])] : []),
			];

			// Add other variations if gemeinde name exists
			if (gemeindeName) {
				possibleNames.push(normaliseText(gemeindeName));
				possibleNames.push(normaliseText(`${bezirkName} ${gemeindeName}`));
			}

			// Remove empty names
			const validNames = possibleNames.filter(Boolean);

			// Try to find a match
			let match = false;
			let matchedRecord = null;
			let matchedRecordIdx = -1;
			let matchType = "";

			// Try exact matches first
			for (const normalisedName of validNames) {
				if (csvLookup.has(normalisedName)) {
					// Get the first unmatched record with this name
					for (const idx of csvLookup.get(normalisedName)) {
						const record = csvRecords.get(idx);
						if (!record.matched) {
							match = true;
							matchedRecord = record;
							matchedRecordIdx = idx;
							matchType = "exact";
							break;
						}
					}
				}
				if (match) break;
			}

			// If no exact match, try substring matching
			if (!match) {
				for (const normalisedName of validNames) {
					if (!normalisedName) continue;

					// Try all CSV entries for substring matches
					for (const [idx, record] of csvRecords.entries()) {
						if (record.matched) continue;

						const csvNormName = normaliseText(record.name);
						if (csvNormName.includes(normalisedName) || normalisedName.includes(csvNormName)) {
							match = true;
							matchedRecord = record;
							matchedRecordIdx = idx;
							matchType = "substring";
							break;
						}
					}
					if (match) break;
				}
			}

			if (match && matchedRecordIdx >= 0) {
				// Mark as matched
				csvRecords.get(matchedRecordIdx).matched = true;
				matchDetails.set(bezirkFull, `Matched with "${matchedRecord.name}" (${matchType})`);

				// Check if vote counts match
				if (bezirk.anzahl_wähler !== matchedRecord.voters) {
					mismatches.push({
						bezirkName: bezirkFull,
						sourceVoters: bezirk.anzahl_wähler,
						csvVoters: matchedRecord.voters,
						difference: bezirk.anzahl_wähler - matchedRecord.voters,
					});
				}
			} else {
				missingInCSV.push({
					name: bezirkFull,
					voters: bezirk.anzahl_wähler,
				});
			}
		}

		// Find all unmatched CSV entries
		const unmatchedEntries = [];
		let totalUnmatchedVoters = 0;

		for (const [idx, record] of csvRecords.entries()) {
			if (!record.matched) {
				unmatchedEntries.push(record);
				totalUnmatchedVoters += record.voters;
			}
		}

		// Display results
		console.log("\nCSV entries not matched:");
		console.log("------------------------");

		if (unmatchedEntries.length === 0) {
			console.log("All CSV entries were matched.");
		} else {
			// Sort by name for better display
			unmatchedEntries.sort((a, b) => a.name.localeCompare(b.name));

			for (const entry of unmatchedEntries) {
				console.log(`Only in CSV: ${entry.name} (${entry.voters} voters)`);
			}

			console.log(`\nTotal unmatched voters: ${totalUnmatchedVoters.toLocaleString()}`);
		}

		// Report mismatches
		if (mismatches.length > 0) {
			console.log("\nVote count mismatches:");
			console.log("----------------------");

			let totalMismatchDifference = 0;
			mismatches.forEach((mismatch) => {
				console.log(
					`${mismatch.bezirkName}: Source=${mismatch.sourceVoters}, CSV=${mismatch.csvVoters}, Diff=${mismatch.difference}`
				);
				totalMismatchDifference += mismatch.difference;
			});

			console.log(`\nTotal difference from mismatches: ${totalMismatchDifference} votes`);
		}

		// Calculate the total CSV voters
		let totalCSVVoters = 0;
		for (const record of csvRecords.values()) {
			totalCSVVoters += record.voters;
		}

		// Detailed breakdown of the discrepancy
		const totalDiscrepancy = totalCSVVoters - totalSourceVoters;
		console.log("\nDiscrepancy breakdown:");
		console.log("---------------------");
		console.log(`Total voters in CSV: ${totalCSVVoters.toLocaleString()}`);
		console.log(`Total voters in source: ${totalSourceVoters.toLocaleString()}`);
		console.log(`Overall difference: ${totalDiscrepancy.toLocaleString()} voters`);
		console.log(
			`Unmatched CSV entries account for: ${totalUnmatchedVoters.toLocaleString()} voters (${(
				(totalUnmatchedVoters / totalDiscrepancy) *
				100
			).toFixed(1)}%)`
		);

		const mismatchTotal = mismatches.reduce((sum, m) => sum - m.difference, 0);
		console.log(
			`Vote count mismatches account for: ${mismatchTotal.toLocaleString()} voters (${(
				(mismatchTotal / totalDiscrepancy) *
				100
			).toFixed(1)}%)`
		);

		const remainingDiff = totalDiscrepancy - totalUnmatchedVoters - mismatchTotal;
		console.log(
			`Remaining unexplained difference: ${remainingDiff.toLocaleString()} voters (${(
				(remainingDiff / totalDiscrepancy) *
				100
			).toFixed(1)}%)`
		);

		// Additional detail for deeper analysis
		if (remainingDiff !== 0) {
			console.log("\nPossible explanations for remaining difference:");
			console.log("1. Alternative district names or formats causing incorrect matching");
			console.log("2. Aggregation differences between data sources");
			console.log("3. Updates to official results that weren't reflected in source data");
		}

		// Summary statistics
		console.log("\nSummary:");
		console.log(`Total districts in source: ${bezirke.length}`);
		console.log(`Total matched with CSV: ${matchDetails.size}`);
		console.log(`Total mismatches: ${mismatches.length}`);
		console.log(`Total CSV records: ${csvRecords.size}`);
		console.log(`Total unmatched CSV entries: ${unmatchedEntries.length}`);
		console.log(`Missing in CSV: ${missingInCSV.length}`);

		// Group unmatched entries by patterns to identify systematic issues
		const patterns = {
			briefwahl: 0,
			briefwahlVoters: 0,
			gemeinde: 0,
			gemeindeVoters: 0,
			other: 0,
			otherVoters: 0,
		};

		for (const entry of unmatchedEntries) {
			if (/brief/i.test(entry.name)) {
				patterns.briefwahl++;
				patterns.briefwahlVoters += entry.voters;
			} else if (/^\d{3}-\d{2}/.test(entry.name)) {
				patterns.gemeinde++;
				patterns.gemeindeVoters += entry.voters;
			} else {
				patterns.other++;
				patterns.otherVoters += entry.voters;
			}
		}

		console.log("\nUnmatched entries patterns:");
		console.log(
			`Postal vote districts (Briefwahl): ${patterns.briefwahl} entries, ${patterns.briefwahlVoters.toLocaleString()} voters`
		);
		console.log(`Numbered districts: ${patterns.gemeinde} entries, ${patterns.gemeindeVoters.toLocaleString()} voters`);
		console.log(`Other districts: ${patterns.other} entries, ${patterns.otherVoters.toLocaleString()} voters`);
	} catch (error) {
		console.error(`Error processing CSV file:`, error);
	}
}

/**
 * Shows a detailed metadata summary for a specific constituency
 */
function showConstituencySummary(
	wahlkreisId: string,
	csvFilePath: string = __dirname + "/results.csv",
	nameColumn: string = "gebiet-name",
	votersColumn: string = "B"
): void {
	console.log("\n======== CONSTITUENCY METADATA ========");

	try {
		// Load wahlbezirke data
		const wahlbezirke = require("./data/wahlbezirkeList.json") as ResultType[];

		// Get bezirke for the specified wahlkreis
		const bezirke = wahlbezirke.filter((x) => {
			if (!x.wahlkreis_id) return false;
			return parseInt(x.wahlkreis_id).toString() === wahlkreisId;
		});

		if (bezirke.length === 0) {
			console.log(`No data found for Constituency ${wahlkreisId}`);
			return;
		}

		// Get constituency name
		const name = wahlkreiseNamen[wahlkreisId] || "Unknown";

		// Calculate totals from our JSON data
		const gemeinden = new Set<string>();

		// Use reduce for more efficient calculation
		const totals = bezirke.reduce(
			(acc, bezirk) => {
				acc.totalVoters += bezirk.anzahl_wähler || 0;
				acc.totalEligible += bezirk.anzahl_berechtigte || 0;

				if (bezirk.gemeinde_name) {
					gemeinden.add(bezirk.gemeinde_name);
				}

				// Count party votes
				Object.entries(bezirk.zweitstimmen?.parteien || {}).forEach(([party, votes]) => {
					acc.partyVotes[party] = (acc.partyVotes[party] || 0) + votes;
				});

				return acc;
			},
			{ totalVoters: 0, totalEligible: 0, partyVotes: {} }
		);

		// Process CSV data
		const csvContent = fs.readFileSync(path.resolve(csvFilePath), "utf8");
		const records = parse(csvContent, {
			columns: true,
			skip_empty_lines: true,
			trim: true,
			delimiter: ";",
			relax_column_count: true,
		});

		// Create a set of normalized source district names for matching
		const sourceDistrictSet = new Set<string>();
		for (const bezirk of bezirke) {
			const bezirkName = bezirk.wahlbezirk_name || bezirk.wahlbezirk_id || "";
			const gemeindeName = bezirk.gemeinde_name || "";

			sourceDistrictSet.add(normaliseText(bezirkName));
			if (gemeindeName) {
				sourceDistrictSet.add(normaliseText(gemeindeName));
			}
		}

		// Process CSV records
		let csvVoters = 0;
		let csvRecords = 0;
		const unmatchedEntries = [];

		for (const record of records) {
			const voters = parseInt(record[votersColumn], 10);
			if (isNaN(voters)) continue;

			csvVoters += voters;
			csvRecords++;

			// Check if this record exists in our source data
			const recordName = record[nameColumn]?.trim();
			if (!recordName) continue;

			const normName = normaliseText(recordName);

			// Check if this is a new district not in our source
			let found = false;

			// Try direct match
			if (sourceDistrictSet.has(normName)) {
				found = true;
			} else {
				// Try substring matching
				for (const sourceName of sourceDistrictSet) {
					if (sourceName.includes(normName) || normName.includes(sourceName)) {
						found = true;
						break;
					}
				}
			}

			if (!found) {
				unmatchedEntries.push({
					name: recordName,
					voters,
				});
			}
		}

		// Sort unmatched entries by voter count
		unmatchedEntries.sort((a, b) => b.voters - a.voters);

		// Calculate total unmatched voters
		const unmatchedVoters = unmatchedEntries.reduce((sum, entry) => sum + entry.voters, 0);

		// Print constituency information
		console.log(`Constituency: ${wahlkreisId} - ${name}`);
		console.log(`Total districts in our data: ${bezirke.length}`);
		console.log(`Municipalities (Gemeinden): ${gemeinden.size}`);
		console.log(`Our voters count: ${totals.totalVoters.toLocaleString()}`);
		console.log(`Our eligible voters: ${totals.totalEligible.toLocaleString()}`);

		// Calculate turnout percentage
		const turnout = totals.totalEligible > 0 ? ((totals.totalVoters / totals.totalEligible) * 100).toFixed(2) + "%" : "N/A";
		console.log(`Our turnout: ${turnout}`);

		// Print top 3 parties
		const topParties = Object.entries(totals.partyVotes)
			.sort(([, a], [, b]) => (b as number) - (a as number))
			.slice(0, 3);

		if (topParties.length > 0) {
			console.log("\nTop 3 parties:");
			topParties.forEach(([party, votes]) => {
				const pct = (((votes as number) / totals.totalVoters) * 100).toFixed(1);
				console.log(`- ${party}: ${(votes as number).toLocaleString()} (${pct}%)`);
			});
		}

		// Display CSV comparison
		console.log(`\nCSV data (${csvFilePath}):`);
		console.log(`Records found: ${csvRecords}`);
		console.log(`CSV voters total: ${csvVoters.toLocaleString()}`);

		const diff = Math.abs(totals.totalVoters - csvVoters);
		const diffPct = ((diff / csvVoters) * 100).toFixed(2);
		console.log(`Difference: ${diff.toLocaleString()} (${diffPct}%)`);

		// Show unmatched CSV entries
		if (unmatchedEntries.length > 0) {
			console.log(`\nCSV records not found in our data: ${unmatchedEntries.length}`);
			console.log(`Unmatched voters: ${unmatchedVoters.toLocaleString()} voters`);
			console.log(`This accounts for ${((unmatchedVoters / diff) * 100).toFixed(1)}% of the difference`);

			// Group by district types
			const briefwahlCount = unmatchedEntries.filter((e) => /brief/i.test(e.name)).length;
			const briefwahlVoters = unmatchedEntries.filter((e) => /brief/i.test(e.name)).reduce((sum, e) => sum + e.voters, 0);

			const gemeindeCount = unmatchedEntries.filter((e) => !/brief/i.test(e.name) && !/^\d{3}-\d{2}/.test(e.name)).length;
			const gemeindeVoters = unmatchedEntries
				.filter((e) => !/brief/i.test(e.name) && !/^\d{3}-\d{2}/.test(e.name))
				.reduce((sum, e) => sum + e.voters, 0);

			console.log(`\nUnmatched entry types:`);
			console.log(
				`- Postal vote districts: ${briefwahlCount} entries, ${briefwahlVoters.toLocaleString()} voters (${(
					(briefwahlVoters / unmatchedVoters) *
					100
				).toFixed(1)}%)`
			);
			console.log(
				`- Municipality districts: ${gemeindeCount} entries, ${gemeindeVoters.toLocaleString()} voters (${(
					(gemeindeVoters / unmatchedVoters) *
					100
				).toFixed(1)}%)`
			);

			// Show top 10 unmatched entries
			console.log(`\nTop unmatched entries by voter count:`);
			unmatchedEntries.slice(0, 10).forEach((entry) => {
				console.log(`- ${entry.name}: ${entry.voters.toLocaleString()} voters`);
			});

			if (unmatchedEntries.length > 10) {
				console.log(`... and ${unmatchedEntries.length - 10} more`);
			}

			// Calculate remaining difference
			const remainingDiff = diff - unmatchedVoters;
			if (remainingDiff > 0) {
				console.log(
					`\nRemaining difference: ${remainingDiff.toLocaleString()} voters (${((remainingDiff / diff) * 100).toFixed(1)}%)`
				);
				console.log("This may be due to vote count mismatches in matched districts.");
			}
		} else {
			console.log(`\nAll CSV entries were matched to districts in our data.`);
			console.log(`The difference is due to vote count mismatches in matched districts.`);
		}
	} catch (error) {
		console.error("Error generating constituency summary:", error);
	}
}

// Example usage
compareWithCSVResults(__dirname + "/results.csv", "gebiet-name", "B", "285");
showConstituencySummary("285");

// Export for use in other scripts
export { compareWithCSVResults, showConstituencySummary };
