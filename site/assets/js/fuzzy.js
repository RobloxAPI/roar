"use strict";

// LICENSE
//
//   This software is dual-licensed to the public domain and under the following
//   license: you are granted a perpetual, irrevocable license to copy, modify,
//   publish, and distribute this file as you see fit.
//
// VERSION
//   0.1.0  (2016-03-28)  Initial release
//
// AUTHOR
//   Forrest Smith
//
// (modified)

// Returns true if each character in pattern is found sequentially within str
function fuzzy_match_simple(pattern, str) {
	let patternIdx = 0;
	let strIdx = 0;
	let patternLength = pattern.length;
	let strLength = str.length;

	while (patternIdx != patternLength && strIdx != strLength) {
		let patternChar = pattern.charAt(patternIdx).toLowerCase();
		let strChar = str.charAt(strIdx).toLowerCase();
		if (patternChar == strChar) {
			++patternIdx;
		};
		++strIdx;
	};

	return patternLength != 0 && strLength != 0 && patternIdx == patternLength ? true : false;
}

// Returns [bool, score]
// bool: true if each character in pattern is found sequentially within str
// score: integer; higher is better match. Value has no intrinsic meaning. Range varies with pattern.
//        Can only compare scores with same search pattern.
export function fuzzy_match(pattern, str) {
	// Score consts
	const perfect_bonus = 100;             // bonus for perfect, case-insensitive matches
	const adjacency_bonus = 5;             // bonus for adjacent matches
	const separator_bonus = 10;            // bonus if match occurs after a separator
	const camel_bonus = 10;                // bonus if match is uppercase and prev is lower
	const leading_letter_penalty = -3;     // penalty applied for every letter in str before the first match
	const max_leading_letter_penalty = -9; // maximum penalty for leading letters
	const unmatched_letter_penalty = -1;   // penalty for every letter that doesn't matter

	// Loop variables
	let score = 0;
	let patternIdx = 0;
	let patternLength = pattern.length;
	let strIdx = 0;
	let strLength = str.length;
	let prevMatched = false;
	let prevLower = false;
	let prevSeparator = true; // true so if first letter match gets separator bonus

	// Use "best" matched letter if multiple string letters match the pattern
	let bestLetter = null;
	let bestLower = null;
	let bestLetterIdx = null;
	let bestLetterScore = 0;

	let matchedIndices = [];

	// Loop over strings
	while (strIdx != strLength) {
		let patternChar = patternIdx != patternLength ? pattern.charAt(patternIdx) : null;
		let strChar = str.charAt(strIdx);

		let patternLower = patternChar != null ? patternChar.toLowerCase() : null;
		let strLower = strChar.toLowerCase();
		let strUpper = strChar.toUpperCase();

		let nextMatch = patternChar && patternLower == strLower;
		let rematch = bestLetter && bestLower == strLower;

		let advanced = nextMatch && bestLetter;
		let patternRepeat = bestLetter && patternChar && bestLower == patternLower;
		if (advanced || patternRepeat) {
			score += bestLetterScore;
			matchedIndices.push(bestLetterIdx);
			bestLetter = null;
			bestLower = null;
			bestLetterIdx = null;
			bestLetterScore = 0;
		}

		if (nextMatch || rematch) {
			let newScore = 0;

			// Apply penalty for each letter before the first pattern match
			// Note: std::max because penalties are negative values. So max is smallest penalty.
			if (patternIdx == 0) {
				let penalty = Math.max(strIdx * leading_letter_penalty, max_leading_letter_penalty);
				score += penalty;
			}

			// Apply bonus for consecutive bonuses
			if (prevMatched) {
				newScore += adjacency_bonus;
			}

			// Apply bonus for matches after a separator
			if (prevSeparator) {
				newScore += separator_bonus;
			}

			// Apply bonus across camel case boundaries. Includes "clever" isLetter check.
			if (prevLower && strChar == strUpper && strLower != strUpper) {
				newScore += camel_bonus;
			}

			// Update patter index IFF the next pattern letter was matched
			if (nextMatch) {
				++patternIdx;
			}

			// Update best letter in str which may be for a "next" letter or a "rematch"
			if (newScore >= bestLetterScore) {

				// Apply penalty for now skipped letter
				if (bestLetter != null) {
					score += unmatched_letter_penalty;
				}

				bestLetter = strChar;
				bestLower = bestLetter.toLowerCase();
				bestLetterIdx = strIdx;
				bestLetterScore = newScore;
			}

			prevMatched = true;
		}
		else {
			score += unmatched_letter_penalty;
			prevMatched = false;
		}

		// Includes "clever" isLetter check.
		prevLower = strChar == strLower && strLower != strUpper;
		prevSeparator = strChar == '_' || strChar == ' ';

		++strIdx;
	}

	// Apply score for last match
	if (bestLetter) {
		score += bestLetterScore;
		matchedIndices.push(bestLetterIdx);
	}

	// Apply bonus for perfect match
	if (pattern.toLowerCase() === str.toLowerCase()) {
		score += perfect_bonus;
	};

	const matched = patternIdx == patternLength;
	return [matched, score];
};
