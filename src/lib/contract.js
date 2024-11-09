import * as map from '../lib/map.js'

/** @param {NS} ns */
export async function main(ns) {
  findContracts(ns)
}

/** @param {NS} ns */
export function findContracts(ns) {
  let nodes = map.getAllNodes(ns)
  let contract_types = {}
  nodes.forEach((node) => {
    let files = ns.ls(node)
    let contracts = files.filter((file) => {
      return file.endsWith('cct')
    })

    contracts.forEach((contract) => {
      let contract_type = ns.codingcontract.getContractType(contract, node)
      if (!executeContract(ns, contract, node)) {
        if (!(contract_type in contract_types)) {
          contract_types[contract_type] = []
        }

        contract_types[contract_type].push([node, contract])
      }
    })
  })

  let priorities = Object.entries(contract_types).sort((a, b) => b[1].length - a[1].length)
  for (let i = 0; i < priorities.length; i++) {
    ns.tprint(`${priorities[i][1].length} of contract type ${priorities[i][0]}`)
    if (i == 0) {
      ns.tprint(`Sample:\n${ns.codingcontract.getDescription(priorities[i][1][0][1], priorities[i][1][0][0])}`)
    }
  }
}

/** @param {NS} ns */
export function executeContract(ns, contract_file, host) {
  let contract_func = getContractFunc(ns, contract_file, host)
  if (contract_func) {
    let contract_data = ns.codingcontract.getData(contract_file, host)
    let reward = ns.codingcontract.attempt(contract_func(ns, contract_data), contract_file, host)
    if (reward) {
      ns.tprint(`\u2705 Reward "${reward}" for completing ${contract_file} on ${host}.`)
    } else {
      ns.tprint(`\u274C Failed contract ${contract_file} on ${host}.`)
      ns.tprint(`Description: ${ns.codingcontract.getDescription(contract_file, host)}\nContract Data: ${contract_data}`)
    }

    return reward
  }

  return false
}

function getContractFunc(ns, contract_file, host) {
  let contract_type = ns.codingcontract.getContractType(contract_file, host)
  switch (contract_type) {
    case "Encryption I: Caesar Cipher":
      return caesar
    case "Find Largest Prime Factor":
      return largestPrimeFactor
    case "Generate IP Addresses":
      return generateIp
    case "Spiralize Matrix":
      return spiralize
    case "Subarray with Maximum Sum":
      return subarrayMaxSum
    case "Unique Paths in a Grid I":
    case "Unique Paths in a Grid II":
      return uniquePaths
    case "Total Ways to Sum":
      var contract_data = ns.codingcontract.getData(contract_file, host)
      if (contract_data > 60) {
        ns.tprint(`Rejecting TWTS ${contract_data}`)
        return null
      }
    case "Total Ways to Sum II":
      contract_data = ns.codingcontract.getData(contract_file, host)
      if (contract_data[0] > 60) {
        ns.tprint(`Rejecting TWTSII ${contract_data}`)
        return null
      }

      return waysToSum
    default:
      return null
  }
}

/** @param {NS} ns */
export function subarrayMaxSum(ns, data) {
  let subarray = data
  let max_sum = 0
  let current_sum = 0
  for (let r = 0; r < subarray.length; r++) {
    current_sum += subarray[r]
    if (current_sum < 0) {
      current_sum = 0
    }

    if (current_sum > max_sum) {
      max_sum = current_sum
    }
  }

  ns.tprint(`Found subarrayMaxSum of ${max_sum} for ${data}`)
  return max_sum
}

export function uniquePaths(ns, data) {
  if (Array.isArray(data[0])) {
    // data is [][]; Unique Paths in a Grid II 
    var map = data
  } else {
    // data is [rows, cols]l Unique Paths in a Grid I
    var map = Array.from({ length: data[0] }, () => new Array(data[1]).fill(0));
  }

  let rows = map.length
  let cols = map[0].length
  if (map[0][0] != 0) {
    return 0
  }

  // Always one path to the first element.
  map[0][0] = -1
  // Count paths (using negative since +1 is blocked)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (map[y][x] > 0)
        // Blocked tile.
        continue

      // Check right:
      if (x+1 < cols && map[y][x+1] <= 0) {
        // Increase the number of paths to that element.
        map[y][x+1] += map[y][x]
      }

      // Check down
      if (y+1 < rows && map[y+1][x] <= 0) {
        map[y+1][x] += map[y][x]
      }
    }
  }
  let unique_paths = -1 * map[rows - 1][cols - 1]
  ns.tprint(`Found uniquePaths of ${unique_paths} for ${data}`)
  return unique_paths
}

export function waysToSum(ns, data, parent) {
  if (Array.isArray(data)) {
    var sum = data[0]
    var allowed_values = new Set([...data[1].sort((a, b) => b - a)])
    // Total Ways to Sum II
  } else {
    var sum = data
  }

  let result_cache = new Set()
  let all_ways_cache = {}
  all_ways_cache[1] = [[1]]
  waysToSumR(ns, sum, sum, all_ways_cache, allowed_values)
  all_ways_cache[sum].forEach((w) => {
    if (!(allowed_values && containsProhibitedValues(w, allowed_values))) {
      result_cache.add(w)
    }
  })

  let result = result_cache.size - 1 // [sum, 0, ..., 0] doesn't count
  if (allowed_values) {
    result += 1 // already filtered out
  }

  ns.tprint(`Found waysToSum of ${result} for ${data}`)
  return result
}

function waysToSumR(ns, sum, parent_sum, ways_cache, allowed_values) {
  if (sum in ways_cache) {
    return
  }

  let array_len = sum
  if (allowed_values) {
    array_len = allowed_values.size
  }

  if (!allowed_values || allowed_values.has(sum)) {
    ways_cache[sum] = [[sum]]
  } else {
    ways_cache[sum] = []
  }


  if (!allowed_values) {
    let i = 1
    if (sum > parent_sum) {
      i = sum - parent_sum
    }
    for (; i < sum; i++) {
      let line = [sum - i]
      waysToSumR(ns, i, sum - i, ways_cache, allowed_values)
      ways_cache[i].forEach((way) => {
        let result = line.concat(way)
        if (isSortedDescending(result)) {
          ways_cache[sum].push(line.concat(way))
        }
      })
    }
  } else {
    for (const i of allowed_values) {
      let line = [i]
      if (sum - i < 1) {
        continue
      }

      waysToSumR(ns, sum - i, i, ways_cache, allowed_values)
      ways_cache[sum - i].forEach((way) => {
        let result = line.concat(way)
        if (!containsProhibitedValues(result, allowed_values) && isSortedDescending(result)) {
          ways_cache[sum].push(line.concat(way))
        }
      })
    }
  }
}

function containsProhibitedValues(result, allowed_values) {
  if (!allowed_values) {
    return false
  }

  for (let i = 0; i < result.length; i++) {
    if (result[i] == 0) {
      // EOS
      return false
    }
    if (!allowed_values.has(result[i])) {
      return true
    }
  }
}

function isSortedDescending(arr) {
  let len = arr.length
  if (len < 2) {
    return true
  }

  let last = arr[0]
  for (let i = 0; i < arr.length; i++) {
    if (last < arr[i]) {
      return false
    }
    last = arr[i]
  }

  return true
}

export function largestPrimeFactor(ns, data) {
  let result = 2
  let remaining = data
  for (const prime of findTestPrimes(ns, data)) {
    if (remaining % prime == 0) {
      remaining /= prime
      result = prime
    }
  }

  if (remaining > 1) {
    result = remaining
  }

  ns.tprint(`Found largestPrimeFactor of ${result} for ${data}`)
  return result
}

function findTestPrimes(ns, data) {
  let primes = [2]
  for (let i = 3; i <= Math.sqrt(data); i++){
    if (!primes.some((prime) => i % prime == 0)) {
      primes.push(i)
    }
  }

  return primes.sort((a, b) => a - b)
}

export function generateIp(ns, data) {
  let result = generateIpR(ns, data, 3)
  ns.tprint(`Found generateIp of ${result} for ${data}`)
  return result
}

function generateIpR(ns, substr, remaining_sections) {
  let results = []
  for (let i = 1; i < Math.min(4, substr.length + 1); i++) {
    // Can't start with a 0 unless it's length of 1
    if (i > 1 && substr[0] == '0') {
      break
    }

    let fragment_str = substr.substring(0, i)
    if (parseInt(fragment_str) < 256) {
      if (!remaining_sections) {
        if (i != substr.length) {
          // Need to use remainder of string
          continue
        }

        // Last fragment
        results.push(fragment_str)
        continue
      }

      generateIpR(ns, substr.substring(i), remaining_sections - 1).forEach((fragment) => {
        results.push(`${fragment_str}.${fragment}`)
      })
    }
  }
  return results
}

export function caesar(ns, data) {
  let str = data[0]
  let shift = data[1]
  let result = []
  let code_start = 'A'.charCodeAt(0)
  let code_last = 'Z'.charCodeAt(0)
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i)
    if (code < code_start || code > code_last) {
      result.push(String.fromCharCode(code))
      continue
    }

    code = code - shift
    if (code < code_start) {
      code += 26
    }
    result.push(String.fromCharCode(code))
  }

  result = result.join("")
  ns.tprint(`Found caesar of ${result} for ${data}`)
  return result
}

export function spiralize(ns, data) {
  let result = []
  let height = data.length
  let width = data[0].length
  let result_len = height * width
  let directions = ['r', 'd', 'l', 'u']
  let d = 0
  let x = 0
  let y = 0
  let w_pad = 0
  let h_pad = 0 
  for (let i = 0; i < result_len; i++) {
    if (directions[d] == 'r') {
      if (x < width - w_pad) {
        result.push(data[y][x])
        x++
        continue
      } else {
        x--
        y++
        d++
        d %= directions.length
      }
    }
    if (directions[d] == 'd') {
      if (y < height - h_pad) {
        result.push(data[y][x])
        y++
        continue
      } else {
        y--
        x--
        d++
        h_pad++
        d %= directions.length
      }
    }
    if (directions[d] == 'l') {
      if (x >= 0 + w_pad) {
        result.push(data[y][x])
        x--
        continue
      } else {
        x++
        y--
        d++
        d %= directions.length
      }
    }
    if (directions[d] == 'u') {
      if (y >= 0 + h_pad) {
        result.push(data[y][x])
        y--
        continue
      } else {
        // Need to do another value becaouse 'r' needs a chance to come after this.
        i--
        y++
        x++
        w_pad++
        d++
        d %= directions.length
      }
    }
  }

  ns.tprint(`Found spiralize of ${result} for ${data}`)
  return result
}

export function hamming(ns, data) {
//    Examples:
//  '111[1]0[000]' passes the parity checks and has data bits of 1000, which is 8 in binary.
//  '100[1]1[010]1[0]' fails the parity checks and needs the last bit to be corrected to get '1001101011', after which the data bits are found to be 10101, which is 21 in binary.


}
// export function sanitizeParens(ns, data) {
//   for (let i = 0; i < data.length; i++) {

//   }
// }