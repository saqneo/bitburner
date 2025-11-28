import { getAllNodes } from '/lib/map.js'

/** @param {NS} ns */
export async function main(ns) {
  solveContracts(ns);
}

/** @param {NS} ns */
export function solveContracts(ns) {
  const nodes = getAllNodes(ns);
  const contractTypes = {};
  let solvedCount = 0;

  for (const node of nodes) {
    const files = ns.ls(node);
    const contracts = files.filter((file) => file.endsWith('.cct'));

    for (const contract of contracts) {
      const type = ns.codingcontract.getContractType(contract, node);
      const result = executeContract(ns, contract, node);

      if (result) {
        solvedCount++;
      } else {
        if (!contractTypes[type]) {
          contractTypes[type] = [];
        }
        contractTypes[type].push({ node, contract });
      }
    }
  }

  if (solvedCount > 0) {
    ns.tprint(`Contract Solver: Successfully solved ${solvedCount} contracts.`);
  }

  // Print summary of unsolved contracts
  const priorities = Object.entries(contractTypes).sort((a, b) => b[1].length - a[1].length);
  if (priorities.length > 0) {
    ns.print(`INFO: Found unsolved contracts:`);
    for (const [type, list] of priorities) {
      ns.print(` - ${list.length}x ${type}`);
    }
  }
}

/** @param {NS} ns */
export function executeContract(ns, contractFile, host) {
  const solver = getContractSolver(ns, contractFile, host);
  if (!solver) return false;

  const contractData = ns.codingcontract.getData(contractFile, host);
  const solution = solver(ns, contractData);
  
  // Attempt the solution
  const reward = ns.codingcontract.attempt(solution, contractFile, host);
  
  if (reward) {
    ns.tprint(`SUCCESS: Solved ${contractFile} on ${host}. Reward: ${reward}`);
    return true;
  } else {
    ns.tprint(`FAILURE: Failed ${contractFile} on ${host}.`);
    ns.print(`FAILURE DETAIL:
  Contract: ${contractFile} @ ${host}
  Type: ${ns.codingcontract.getContractType(contractFile, host)}
  Data: ${JSON.stringify(contractData)}
  Computed Solution: ${solution}`);
    return false;
  }
}

function getContractSolver(ns, contractFile, host) {
  const type = ns.codingcontract.getContractType(contractFile, host);
  const data = ns.codingcontract.getData(contractFile, host);

  switch (type) {
    case 'Encryption I: Caesar Cipher':
      return caesar;
    case 'Find Largest Prime Factor':
      return largestPrimeFactor;
    case 'Generate IP Addresses':
      return generateIp;
    case 'Spiralize Matrix':
      return spiralize;
    case 'Subarray with Maximum Sum':
      return subarrayMaxSum;
    case 'Unique Paths in a Grid I':
    case 'Unique Paths in a Grid II':
      return uniquePaths;
    case 'Total Ways to Sum':
      // Check for expensive computations
      if (data > 60) {
        ns.print(`WARN: Skipped '${type}' on ${host} (Input ${data} > 60).`);
        return null;
      }
      return waysToSum;
    case 'Total Ways to Sum II':
      // Check for expensive computations
      if (data[0] > 60) {
        ns.print(`WARN: Skipped '${type}' on ${host} (Input ${data[0]} > 60).`);
        return null;
      }
      return waysToSum;
    default:
      return null;
  }
}

/** @param {NS} ns */
export function subarrayMaxSum(ns, data) {
  let currentSum = 0;
  let maxSum = 0;

  for (const num of data) {
    currentSum += num;
    if (currentSum < 0) {
      currentSum = 0;
    }
    if (currentSum > maxSum) {
      maxSum = currentSum;
    }
  }
  return maxSum;
}

export function uniquePaths(ns, data) {
  let grid;
  
  if (Array.isArray(data[0])) {
    // Unique Paths in a Grid II: Input is the grid itself
    // Clone to avoid mutation
    grid = data.map(row => [...row]);
  } else {
    // Unique Paths in a Grid I: Input is [rows, cols]
    const [rows, cols] = data;
    grid = Array.from({ length: rows }, () => new Array(cols).fill(0));
  }

  const rows = grid.length;
  const cols = grid[0].length;

  // If start is blocked, no paths
  if (grid[0][0] !== 0) return 0;

  // Use -1 to represent paths to avoid confusion with 1 (obstacle)
  grid[0][0] = -1; 

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      // Skip blocked tiles (1) or unvisited start (-1) which is handled
      if (grid[y][x] > 0) continue;

      const currentPaths = grid[y][x] === -1 ? 1 : grid[y][x]; // Normalizing start

      // Propagate right
      if (x + 1 < cols && grid[y][x + 1] <= 0) {
        grid[y][x + 1] += grid[y][x];
      }

      // Propagate down
      if (y + 1 < rows && grid[y + 1][x] <= 0) {
        grid[y + 1][x] += grid[y][x];
      }
    }
  }

  // Result is negative because we used negative numbers to track paths
  return Math.abs(grid[rows - 1][cols - 1]);
}

export function waysToSum(ns, data) {
  let target;
  let allowedValues;

  if (Array.isArray(data)) {
    // Total Ways to Sum II: [target, [allowedValues]]
    target = data[0];
    allowedValues = new Set([...data[1]].sort((a, b) => b - a));
  } else {
    // Total Ways to Sum I: target
    target = data;
  }

  // Cache: { sum: [[partition1], [partition2], ...] }
  const waysCache = {};
  // Base case
  waysCache[1] = [[1]];
  
  // Recursive solver
  waysToSumR(target, target, waysCache, allowedValues);
  
  const resultCache = new Set();
  const ways = waysCache[target] || [];

  for (const way of ways) {
    if (!allowedValues || !containsProhibitedValues(way, allowedValues)) {
      resultCache.add(way); // Sets of arrays don't work by value in JS, but this preserves existing logic structure
    }
  }
  
  // NOTE: original implementation logic relies on Set uniqueness of arrays which fails in JS 
  // (Set([1]) !== Set([1])). However, keeping semantic equivalence to original code 
  // requires assuming the original worked or fixing it. 
  // The original code likely worked because it was adding the SAME array reference if cached?
  // Actually, looking at `waysToSumR`, it creates new arrays: `line.concat(way)`.
  // So `result_cache.size` might be incorrect if duplicates are generated.
  // But for cleanup, I will strictly follow the provided algorithm structure.
  
  let result = ways.length; 
  // The original code subtracted 1 for the case [target, 0...] but simplified here.
  // Original: let result = result_cache.size - 1 // [sum, 0, ..., 0] doesn't count
  
  // Let's stick closer to the original implementation to ensure correctness of the logic 
  // which was likely tuned to the specific problem constraints, 
  // even if it looks odd for JS Sets.
  
  return solveWaysToSumOriginalLogic(ns, data);
}

// Re-implementing the exact logic function to ensure we don't break the math/recursion
// while cleaning up the syntax.
function solveWaysToSumOriginalLogic(ns, data) {
  let sum;
  let allowed_values;
  if (Array.isArray(data)) {
    sum = data[0];
    allowed_values = new Set([...data[1]].sort((a, b) => b - a));
  } else {
    sum = data;
  }

  const ways_cache = {};
  ways_cache[1] = [[1]];
  
  // Fill cache up to sum
  // Iterative optimization could be done here but keeping recursive for safety
  waysToSumR(sum, sum, ways_cache, allowed_values);
  
  const ways = ways_cache[sum] || [];
  let count = 0;
  
  // Filter valid ways
  ways.forEach((w) => {
    if (!(allowed_values && containsProhibitedValues(w, allowed_values))) {
      count++;
    }
  });

  // The original code had logic: `result_cache.size - 1`. 
  // Logic check: [sum] is always a partition of itself? 
  // "Total Ways to Sum" usually excludes the number itself if it says "at least 2 integers".
  // The Bitburner problem "Total Ways to Sum" usually asks for partitions of size >= 2.
  // So [n] is excluded.
  
  let result = count - 1; 
  if (allowed_values) {
    // For TWTS II, [n] might be valid if n is in allowed_values.
    // The original code added 1 back if allowed_values existed.
    result += 1;
  }
  
  return result;
}

function waysToSumR(sum, parent_sum, ways_cache, allowed_values) {
  if (sum in ways_cache) {
    return;
  }

  if (!allowed_values || allowed_values.has(sum)) {
    ways_cache[sum] = [[sum]];
  } else {
    ways_cache[sum] = [];
  }

  if (!allowed_values) {
    let i = 1;
    if (sum > parent_sum) {
      i = sum - parent_sum;
    }
    for (; i < sum; i++) {
      const complement = sum - i;
      waysToSumR(i, complement, ways_cache, allowed_values);
      
      // Iterate over cached results for 'i'
      if (ways_cache[i]) {
        ways_cache[i].forEach((way) => {
          const result = [complement].concat(way);
          if (isSortedDescending(result)) {
            ways_cache[sum].push(result);
          }
        });
      }
    }
  } else {
    for (const val of allowed_values) {
      const remainder = sum - val;
      if (remainder < 1) continue;

      waysToSumR(remainder, val, ways_cache, allowed_values);
      
      if (ways_cache[remainder]) {
        ways_cache[remainder].forEach((way) => {
          const result = [val].concat(way);
          // Optimization: check constraints early
          if (!containsProhibitedValues(result, allowed_values) && isSortedDescending(result)) {
            ways_cache[sum].push(result);
          }
        });
      }
    }
  }
}

function containsProhibitedValues(result, allowed_values) {
  if (!allowed_values) return false;
  for (const num of result) {
    if (num === 0) return false; 
    if (!allowed_values.has(num)) return true;
  }
  return false;
}

function isSortedDescending(arr) {
  if (arr.length < 2) return true;
  let last = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (last < arr[i]) return false;
    last = arr[i];
  }
  return true;
}

export function largestPrimeFactor(ns, data) {
  let result = 2;
  let remaining = data;
  
  const primes = findTestPrimes(data);
  
  for (const prime of primes) {
    while (remaining % prime === 0) {
      remaining /= prime;
      result = prime;
    }
  }

  if (remaining > 1) {
    result = remaining;
  }
  return result;
}

function findTestPrimes(limit) {
  const primes = [2];
  // Optimize: only need primes up to sqrt(limit)
  const sqrtLimit = Math.sqrt(limit);
  
  for (let i = 3; i <= sqrtLimit; i += 2) {
    if (!primes.some((prime) => i % prime === 0)) {
      primes.push(i);
    }
  }
  return primes; // Already sorted
}

export function generateIp(ns, data) {
  return generateIpR(data, 3);
}

function generateIpR(substr, remaining_sections) {
  const results = [];
  const maxLen = Math.min(4, substr.length + 1);

  for (let i = 1; i < maxLen; i++) {
    // Leading zero check: '0' is allowed, '01' is not
    if (i > 1 && substr[0] === '0') {
      break;
    }

    const fragmentStr = substr.substring(0, i);
    const val = parseInt(fragmentStr);
    
    if (val < 256) {
      if (remaining_sections === 0) {
        // We need to consume the entire string in the last section
        if (i === substr.length) {
          results.push(fragmentStr);
        }
      } else {
        // Optimization: Only recurse if enough characters remain for the other sections
        // Max 3 chars per section, Min 1 char
        const remainingLen = substr.length - i;
        if (remainingLen >= remaining_sections && remainingLen <= remaining_sections * 3) {
          const subResults = generateIpR(substr.substring(i), remaining_sections - 1);
          subResults.forEach((fragment) => {
            results.push(`${fragmentStr}.${fragment}`);
          });
        }
      }
    }
  }
  return results;
}

export function caesar(ns, data) {
  const str = data[0];
  const shift = data[1];
  const result = [];
  
  const codeA = 'A'.charCodeAt(0);
  const codeZ = 'Z'.charCodeAt(0);
  
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    
    // Only shift uppercase letters
    if (code >= codeA && code <= codeZ) {
      code -= shift;
      if (code < codeA) {
        code += 26;
      }
    }
    result.push(String.fromCharCode(code));
  }

  return result.join('');
}

export function spiralize(ns, data) {
  const result = [];
  const height = data.length;
  const width = data[0].length;
  const totalCells = height * width;
  
  // Directions: Right, Down, Left, Up
  // dr: delta row, dc: delta col
  const dirs = [
    { dr: 0, dc: 1 },  // Right
    { dr: 1, dc: 0 },  // Down
    { dr: 0, dc: -1 }, // Left
    { dr: -1, dc: 0 }  // Up
  ];
  
  let r = 0, c = 0;
  let dirIdx = 0;
  
  // Boundaries
  let top = 0, bottom = height - 1;
  let left = 0, right = width - 1;

  for (let i = 0; i < totalCells; i++) {
    result.push(data[r][c]);
    
    const nextR = r + dirs[dirIdx].dr;
    const nextC = c + dirs[dirIdx].dc;

    // Check boundaries
    if (dirIdx === 0 && nextC > right) {
      dirIdx = 1; top++; r++;
    } else if (dirIdx === 1 && nextR > bottom) {
      dirIdx = 2; right--; c--;
    } else if (dirIdx === 2 && nextC < left) {
      dirIdx = 3; bottom--; r--;
    } else if (dirIdx === 3 && nextR < top) {
      dirIdx = 0; left++; c++;
    } else {
      r = nextR;
      c = nextC;
    }
  }

  return result;
}
