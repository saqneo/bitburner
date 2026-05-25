
import { getAllNodes } from '/lib/map.js'

/** @param {NS} ns */
export async function main(ns) {
  solveContracts(ns);
}

/** @param {NS} ns */
export function solveContracts(ns) {
  const nodes = getAllNodes(ns);
  const unsolved = {};
  let solvedCount = 0;

  for (const node of nodes) {
    const files = ns.ls(node);
    const contracts = files.filter((file) => file.endsWith('.cct'));

    for (const contract of contracts) {
      const type = ns.codingcontract.getContractType(contract, node);
      const result = executeContract(ns, contract, node, type);

      if (result) {
        solvedCount++;
      } else {
        if (!unsolved[type]) unsolved[type] = [];
        unsolved[type].push({ node, contract });
      }
    }
  }

  if (solvedCount > 0) {
    ns.tprint(`SUCCESS: Solved ${solvedCount} contracts!`);
  }

  // Print summary of EVERYTHING found to the terminal so the user knows why they weren't solved
  const summary = Object.entries(unsolved).sort((a, b) => b[1].length - a[1].length);
  if (summary.length > 0) {
    ns.tprint(`INFO: Found ${Object.values(unsolved).flat().length} unsolved contracts:`);
    for (const [type, list] of summary) {
      ns.tprint(` - ${list.length}x "${type}" (No solver implemented yet)`);
    }
  } else if (solvedCount === 0) {
    ns.print("No contracts found on the network.");
  }
}

/** @param {NS} ns */
export function executeContract(ns, contractFile, host, type) {
  const solver = getContractSolver(type);
  if (!solver) return false;

  const contractData = ns.codingcontract.getData(contractFile, host);
  let solution;
  try {
      solution = solver(ns, contractData);
  } catch (e) {
      ns.tprint(`ERROR: Solver crashed for ${contractFile} on ${host}: ${e}`);
      return false;
  }
  
  const reward = ns.codingcontract.attempt(solution, contractFile, host);
  
  if (reward) {
    ns.tprint(`SUCCESS: Solved "${type}" on ${host}. Reward: ${reward}`);
    return true;
  } else {
    // Failure detail goes to logs to avoid terminal spam
    ns.print(`FAILURE: Failed ${contractFile} on ${host}.
  Type: ${type}
  Data: ${JSON.stringify(contractData)}
  Solution: ${JSON.stringify(solution)}`);
    return false;
  }
}

function getContractSolver(type) {
  switch (type) {
    case 'Encryption I: Caesar Cipher': return caesar;
    case 'Find Largest Prime Factor': return largestPrimeFactor;
    case 'Generate IP Addresses': return generateIp;
    case 'Spiralize Matrix': return spiralize;
    case 'Subarray with Maximum Sum': return subarrayMaxSum;
    case 'Unique Paths in a Grid I':
    case 'Unique Paths in a Grid II': return uniquePaths;
    case 'Total Ways to Sum':
    case 'Total Ways to Sum II': return waysToSum;
    case 'Minimum Path Sum in a Triangle': return minPathSumTriangle;
    case 'Merge Overlapping Intervals': return mergeIntervals;
    case 'Array Jumping Game I': return arrayJumpingI;
    default: return null;
  }
}

// --- SOLVERS ---

export function minPathSumTriangle(ns, data) {
    const triangle = data;
    const n = triangle.length;
    const dp = [...triangle[n - 1]];
    for (let i = n - 2; i >= 0; i--) {
        for (let j = 0; j <= i; j++) {
            dp[j] = triangle[i][j] + Math.min(dp[j], dp[j + 1]);
        }
    }
    return dp[0];
}

export function mergeIntervals(ns, data) {
    const intervals = data.sort((a, b) => a[0] - b[0]);
    const merged = [];
    if (intervals.length === 0) return merged;
    let current = intervals[0];
    for (let i = 1; i < intervals.length; i++) {
        const next = intervals[i];
        if (next[0] <= current[1]) {
            current[1] = Math.max(current[1], next[1]);
        } else {
            merged.push(current);
            current = next;
        }
    }
    merged.push(current);
    return merged;
}

export function arrayJumpingI(ns, data) {
    const n = data.length;
    let maxReach = 0;
    for (let i = 0; i < n; i++) {
        if (i > maxReach) return 0;
        maxReach = Math.max(maxReach, i + data[i]);
        if (maxReach >= n - 1) return 1;
    }
    return 1;
}

export function subarrayMaxSum(ns, data) {
  let cur = 0, max = 0;
  for (const n of data) {
    cur = Math.max(0, cur + n);
    max = Math.max(max, cur);
  }
  return max;
}

export function uniquePaths(ns, data) {
  let grid;
  if (Array.isArray(data[0])) grid = data;
  else grid = Array.from({ length: data[0] }, () => new Array(data[1]).fill(0));
  const r = grid.length, c = grid[0].length;
  if (grid[0][0] === 1) return 0;
  const dp = Array.from({ length: r }, () => new Array(c).fill(0));
  dp[0][0] = 1;
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      if (grid[i][j] === 1) continue;
      if (i > 0) dp[i][j] += dp[i - 1][j];
      if (j > 0) dp[i][j] += dp[i][j - 1];
    }
  }
  return dp[r - 1][c - 1];
}

export function waysToSum(ns, data) {
    let target, nums;
    if (Array.isArray(data)) { target = data[0]; nums = data[1]; }
    else { target = data; nums = Array.from({length: target - 1}, (_, i) => i + 1); }
    const dp = new Array(target + 1).fill(0);
    dp[0] = 1;
    for (const n of nums) {
        for (let i = n; i <= target; i++) {
            dp[i] += dp[i - n];
        }
    }
    return Array.isArray(data) ? dp[target] : dp[target];
}

export function largestPrimeFactor(ns, data) {
  let d = 2, n = data;
  while (d * d <= n) {
    if (n % d === 0) n /= d;
    else d++;
  }
  return n;
}

export function generateIp(ns, data) {
  const res = [];
  const backtrack = (start, parts) => {
    if (parts.length === 4) {
      if (start === data.length) res.push(parts.join('.'));
      return;
    }
    for (let len = 1; len <= 3; len++) {
      if (start + len > data.length) break;
      const s = data.substring(start, start + len);
      if ((s[0] === '0' && s.length > 1) || parseInt(s) > 255) continue;
      parts.push(s);
      backtrack(start + len, parts);
      parts.pop();
    }
  };
  backtrack(0, []);
  return res;
}

export function caesar(ns, data) {
  const [s, shift] = data;
  return s.split('').map(c => {
    const code = c.charCodeAt(0);
    if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 - shift + 26) % 26) + 65);
    return c;
  }).join('');
}

export function spiralize(ns, data) {
  const res = [];
  if (data.length === 0) return res;
  let top = 0, bot = data.length - 1, left = 0, right = data[0].length - 1;
  while (top <= bot && left <= right) {
    for (let i = left; i <= right; i++) res.push(data[top][i]);
    top++;
    for (let i = top; i <= bot; i++) res.push(data[i][right]);
    right--;
    if (top <= bot) {
      for (let i = right; i >= left; i--) res.push(data[bot][i]);
      bot--;
    }
    if (left <= right) {
      for (let i = bot; i >= top; i--) res.push(data[i][left]);
      left++;
    }
  }
  return res;
}
