
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
    case 'Encryption II: Vigenère Cipher': return vigenere;
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
    case 'Array Jumping Game':
    case 'Array Jumping Game I': return arrayJumpingI;
    case 'Array Jumping Game II': return arrayJumpingII;
    case 'Algorithmic Stock Trader I': return stockTraderI;
    case 'Algorithmic Stock Trader II': return stockTraderII;
    case 'Algorithmic Stock Trader III': return stockTraderIII;
    case 'Algorithmic Stock Trader IV': return stockTraderIV;
    case 'Compression I: RLE Compression': return rleCompress;
    case 'Square Root': return squareRoot;
    case 'Shortest Path in a Grid': return shortestPathInGrid;
    case 'Total Number of Primes': return totalPrimes;
    case 'HammingCodes: Integer to Encoded Binary': return hammingIntegerToBinary;
    case 'Compression II: LZ Decompression': return lzDecompress;
    case 'Proper 2-Coloring of a Graph': return proper2Coloring;
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
  if (data.length === 0) return 0;
  let cur = data[0], max = data[0];
  for (let i = 1; i < data.length; i++) {
    cur = Math.max(data[i], cur + data[i]);
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
    if (Array.isArray(data)) { 
        target = data[0]; 
        nums = data[1]; 
        if (Array.isArray(target)) target = target[0];
    } else { 
        target = data; 
        nums = Array.from({length: target - 1}, (_, i) => i + 1); 
    }
    const dp = new Array(target + 1).fill(0);
    dp[0] = 1;
    for (const n of nums) {
        for (let i = n; i <= target; i++) {
            dp[i] += dp[i - n];
        }
    }
    return dp[target];
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

export function stockTraderI(ns, data) {
  let minPrice = Infinity;
  let maxProfit = 0;
  for (const price of data) {
    if (price < minPrice) {
      minPrice = price;
    } else {
      maxProfit = Math.max(maxProfit, price - minPrice);
    }
  }
  return maxProfit;
}

export function stockTraderII(ns, data) {
  let profit = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i] > data[i - 1]) {
      profit += data[i] - data[i - 1];
    }
  }
  return profit;
}

export function vigenere(ns, data) {
  const [text, key] = data;
  let result = '';
  let keyIndex = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      const shift = key[keyIndex % key.length].charCodeAt(0) - 65;
      result += String.fromCharCode(((code - 65 + shift) % 26) + 65);
      keyIndex++;
    } else {
      result += char;
    }
  }
  return result;
}

export function rleCompress(ns, data) {
  if (!data) return '';
  let result = '';
  let currentChar = data[0];
  let count = 1;
  for (let i = 1; i < data.length; i++) {
    if (data[i] === currentChar && count < 9) {
      count++;
    } else {
      result += count + currentChar;
      currentChar = data[i];
      count = 1;
    }
  }
  result += count + currentChar;
  return result;
}

export function stockTraderIII(ns, data) {
  return stockTraderIV(ns, [2, data]);
}

export function stockTraderIV(ns, data) {
  const k = data[0];
  const prices = data[1];
  if (prices.length < 2) return 0;
  if (k >= prices.length / 2) {
    let profit = 0;
    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > prices[i - 1]) profit += prices[i] - prices[i - 1];
    }
    return profit;
  }
  const buy = new Array(k + 1).fill(-Infinity);
  const sell = new Array(k + 1).fill(0);
  for (const price of prices) {
    for (let i = 1; i <= k; i++) {
      buy[i] = Math.max(buy[i], sell[i - 1] - price);
      sell[i] = Math.max(sell[i], buy[i] + price);
    }
  }
  return sell[k];
}

export function arrayJumpingII(ns, data) {
  if (data.length <= 1) return 0;
  let jumps = 0;
  let currentEnd = 0;
  let farthest = 0;
  for (let i = 0; i < data.length - 1; i++) {
    farthest = Math.max(farthest, i + data[i]);
    if (i === currentEnd) {
      jumps++;
      currentEnd = farthest;
      if (currentEnd >= data.length - 1) break;
    }
    if (i >= farthest) return 0;
  }
  return currentEnd >= data.length - 1 ? jumps : 0;
}

export function squareRoot(ns, data) {
  const target = BigInt(data);
  if (target < 0n) return "0";
  if (target === 0n || target === 1n) return target.toString();
  let low = 1n;
  let high = target / 2n;
  let root = 0n;
  while (low <= high) {
    const mid = (low + high) / 2n;
    const sq = mid * mid;
    if (sq === target) {
      root = mid;
      break;
    } else if (sq < target) {
      root = mid;
      low = mid + 1n;
    } else {
      high = mid - 1n;
    }
  }
  const root1 = root + 1n;
  const diffRoot = target - root * root;
  const diffRoot1 = root1 * root1 - target;
  const closest = diffRoot <= diffRoot1 ? root : root1;
  return closest.toString();
}

export function shortestPathInGrid(ns, data) {
  const grid = data;
  const rows = grid.length;
  const cols = grid[0].length;
  if (grid[0][0] === 1 || grid[rows - 1][cols - 1] === 1) return "";
  const queue = [[0, 0, ""]];
  const visited = Array.from({ length: rows }, () => new Array(cols).fill(false));
  visited[0][0] = true;
  const directions = [
    [1, 0, "D"],
    [-1, 0, "U"],
    [0, 1, "R"],
    [0, -1, "L"]
  ];
  while (queue.length > 0) {
    const [r, c, path] = queue.shift();
    if (r === rows - 1 && c === cols - 1) return path;
    for (const [dr, dc, move] of directions) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] === 0 && !visited[nr][nc]) {
        visited[nr][nc] = true;
        queue.push([nr, nc, path + move]);
      }
    }
  }
  return "";
}

export function totalPrimes(ns, data) {
  const n = data;
  if (n < 2) return 0;
  
  const isPrime = new Uint8Array(n + 1);
  isPrime.fill(1);
  isPrime[0] = 0;
  isPrime[1] = 0;
  
  for (let p = 2; p * p <= n; p++) {
    if (isPrime[p] === 1) {
      for (let i = p * p; i <= n; i += p) {
        isPrime[i] = 0;
      }
    }
  }
  
  let count = 0;
  for (let i = 2; i <= n; i++) {
    if (isPrime[i] === 1) {
      count++;
    }
  }
  return count;
}

export function hammingIntegerToBinary(ns, data) {
  const num = data;
  const binaryStr = num.toString(2);
  const m = binaryStr.length;
  
  let p = 0;
  while ((1 << p) < m + p + 1) {
    p++;
  }
  
  const totalLen = m + p + 1;
  const code = new Array(totalLen).fill(0);
  
  let dataIdx = 0;
  for (let i = 1; i < totalLen; i++) {
    if ((i & (i - 1)) !== 0) {
      code[i] = parseInt(binaryStr[dataIdx], 10);
      dataIdx++;
    }
  }
  
  for (let pi = 0; pi < p; pi++) {
    const pos = 1 << pi;
    let sum = 0;
    for (let i = 1; i < totalLen; i++) {
      if ((i & pos) !== 0 && i !== pos) {
        sum ^= code[i];
      }
    }
    code[pos] = sum;
  }
  
  let overallParity = 0;
  for (let i = 1; i < totalLen; i++) {
    overallParity ^= code[i];
  }
  code[0] = overallParity;
  
  return code.join("");
}

export function lzDecompress(ns, data) {
  const input = data;
  let out = "";
  let i = 0;
  let isLiteral = true;
  
  while (i < input.length) {
    const len = parseInt(input[i], 10);
    i++;
    
    if (len === 0) {
      isLiteral = !isLiteral;
      continue;
    }
    
    if (isLiteral) {
      out += input.substring(i, i + len);
      i += len;
    } else {
      const dist = parseInt(input[i], 10);
      i++;
      for (let k = 0; k < len; k++) {
        out += out[out.length - dist];
      }
    }
    isLiteral = !isLiteral;
  }
  return out;
}

export function proper2Coloring(ns, data) {
  const numVertices = data[0];
  const edges = data[1];
  
  const adj = Array.from({ length: numVertices }, () => []);
  for (const [u, v] of edges) {
    adj[u].push(v);
    adj[v].push(u);
  }
  
  const colors = new Array(numVertices).fill(-1);
  
  function dfs(node, c) {
    colors[node] = c;
    for (const neighbor of adj[node]) {
      if (colors[neighbor] === -1) {
        if (!dfs(neighbor, 1 - c)) {
          return false;
        }
      } else if (colors[neighbor] === c) {
        return false;
      }
    }
    return true;
  }
  
  for (let i = 0; i < numVertices; i++) {
    if (colors[i] === -1) {
      if (!dfs(i, 0)) {
        return [];
      }
    }
  }
  return colors;
}
