// A map for known acronyms and their expanded forms.
const acronyms = {
  'dki': ['daerah', 'khusus', 'ibukota']
};

/**
 * Cleans and tokenizes a string.
 * e.g., "Daerah Khusus Ibukota Jakarta" -> ['daerah', 'khusus', 'ibukota', 'jakarta']
 * @param {string} str The input string.
 * @returns {string[]} An array of cleaned words.
 */
const tokenize = (str) => {
  if (!str) return [];
  return str
    .toLowerCase()
    .replace(/[.,]/g, '') // Remove commas and periods
    .split(/\s+/)
    .filter(Boolean); // Remove empty strings
};

/**
 * Calculates a match score between a search query and a region name.
 * The score is based on the number of matching words (tokens).
 * It gives a large bonus for matching acronyms.
 * @param {string} query The user's search query (e.g., "Daerah Khusus Ibukota Jakarta").
 * @param {string} regionName The name of the region from the database (e.g., "DKI Jakarta").
 * @returns {number} The match score. Higher is better.
 */
const calculateMatchScore = (query, regionName) => {
  const queryTokens = new Set(tokenize(query));
  const regionTokens = new Set(tokenize(regionName));

  let score = 0;

  // --- Acronym Matching ---
  // Check if the query contains an acronym (e.g., 'dki') and the region name contains the expanded form
  for (const token of regionTokens) {
    if (acronyms[token]) {
      const isMatch = acronyms[token].every(expandedToken => queryTokens.has(expandedToken));
      if (isMatch) {
        score += 100; // High score for acronym match
      }
    }
  }
  // Check the other way around
  for (const token of queryTokens) {
    if (acronyms[token]) {
      const isMatch = acronyms[token].every(expandedToken => regionTokens.has(expandedToken));
      if (isMatch) {
        score += 100;
      }
    }
  }

  // --- Standard Word Matching ---
  const intersection = new Set([...queryTokens].filter(token => regionTokens.has(token)));

  // Add score for each matching word, but don't double-count acronyms
  for (const match of intersection) {
    if (!acronyms[match] && !Object.values(acronyms).flat().includes(match)) {
      score += 10;
    }
  }

  // Give a small bonus for having the same number of tokens, which might indicate a better match
  if (queryTokens.size === regionTokens.size) {
    score += 5;
  }

  return score;
};


/**
 * Finds the best match from a list of regions for a given search query.
 * @param {string} query The user's search query.
 * @param {Array<Object>} regions A list of region objects from the database. Each object must have a 'nama' property.
 * @returns {Object|null} The region object that is the best match, or null if no suitable match is found.
 */
export const findBestMatch = (query, regions) => {
  if (!regions || regions.length === 0) {
    return null;
  }

  let bestMatch = null;
  let highestScore = 0;

  for (const region of regions) {
    const score = calculateMatchScore(query, region.nama);

    // A score of >=10 indicates at least one meaningful word match.
    if (score > highestScore && score >= 10) {
      highestScore = score;
      bestMatch = region;
    }
  }

  return bestMatch;
};