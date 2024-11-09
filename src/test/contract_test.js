import * as libcontract from '../lib/contract.js'

/** @param {NS} ns */
export async function main(ns) {
  // { String, func(ns, data), T_data, Any}
  const tests = [
    {name: 'subarrayMaxSum', func: libcontract.subarrayMaxSum, data: [5, -2, 4], solution: 7},
    {name: 'uniquePaths.I.3x2', func: libcontract.uniquePaths, data: [3, 2], solution: 3},
    {name: 'uniquePaths.I.3x3', func: libcontract.uniquePaths, data: [3, 3], solution: 6},
    {name: 'uniquePaths.II.3x2', func: libcontract.uniquePaths, data: [[ 0, 0, 1],[ 0, 0, 0]], solution: 2},
    {name: 'uniquePaths.II.3x3', func: libcontract.uniquePaths, data: [[ 0, 0, 1],[ 0, 0, 0],[ 0, 1, 0]], solution: 2},
    {name: 'uniquePaths.II.5x9', func: libcontract.uniquePaths, data: [[0,0,1,0,0],[1,1,1,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,1,0,0,0],[0,0,1,0,0],[0,0,1,0,1],[0,0,0,0,1],[1,0,0,0,0]], solution: 0},
    {name: 'waysToSum.I.2', func: libcontract.waysToSum, data: 2, solution: 1},
    {name: 'waysToSum.I.3', func: libcontract.waysToSum, data: 3, solution: 2},
    {name: 'waysToSum.I.4', func: libcontract.waysToSum, data: 4, solution: 4},
    {name: 'waysToSum.I.5', func: libcontract.waysToSum, data: 5, solution: 6},
    {name: 'waysToSum.I.6', func: libcontract.waysToSum, data: 6, solution: 10},
    {name: 'waysToSum.I.7', func: libcontract.waysToSum, data: 7, solution: 14},
    {name: 'waysToSum.I.25', func: libcontract.waysToSum, data: 55, solution: 451275}, // LONG RUNNING ? 
    {name: 'waysToSum.II.5.1', func: libcontract.waysToSum, data: [[5],[2, 3]], solution: 1},
    {name: 'waysToSum.II.5.2', func: libcontract.waysToSum, data: [[5],[2, 3, 18]], solution: 1},
    {name: 'waysToSum.II.18.3', func: libcontract.waysToSum, data: [[18],[2, 3, 6]], solution: 10},
    {name: 'waysToSum.II.18.4', func: libcontract.waysToSum, data: [[18],[17]], solution: 0},
    {name: 'waysToSum.II.5.5', func: libcontract.waysToSum, data: [[65],[5]], solution: 1},
    {name: 'waysToSum.II.5.5', func: libcontract.waysToSum, data: [[87],[5, 12, 13, 65]], solution: 8},
    {name: 'waysToSum.II.5.5', func: libcontract.waysToSum, data: [[53],[1,2,3,4,6,7,8,9,10]], solution: 40586},
    {name: 'largestPrimeFactor.25', func: libcontract.largestPrimeFactor, data: 25, solution: 5},
    {name: 'largestPrimeFactor.503', func: libcontract.largestPrimeFactor, data: 503, solution: 503},
    {name: 'largestPrimeFactor.570292007', func: libcontract.largestPrimeFactor, data: 570292007, solution: 8511821 },
    {name: 'generateIp.1', func: libcontract.generateIp, data: '25525511135', solution: ['255.255.11.135', '255.255.111.35']},
    {name: 'generateIp.2', func: libcontract.generateIp, data: '1938718066', solution: ['193.87.180.66']},
    {name: 'caesar.1', func: libcontract.caesar, data: ['BANANAS', 3], solution: 'YXKXKXP'},
    {name: 'caesar.2', func: libcontract.caesar, data: ['INBOX FLASH VIRUS SHIFT POPUP', 3], solution: 'FKYLU CIXPE SFORP PEFCQ MLMRM'},
    {name: 'spiralize.2', func: libcontract.spiralize, data: [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]], solution: [1, 2, 3, 4, 8, 12, 11, 10, 9, 5, 6, 7]}
  ]
  tests.forEach((test) => { runTest(ns, test) })
}

/** @param {NS} ns */
function runTest(ns, test) {
  const icon_pass = '\u2705'
  const icon_fail = '\u274C'
  let result = test.func(ns, test.data)

  let failure = result != test.solution
  if (Array.isArray(result)) {
    failure = !(result.every((r) => test.solution.includes(r)) && test.solution.every((r) => result.includes(r)))
  }

  if (failure) {
    ns.tprint(`${icon_fail} ${test.name}: Result ${result} != Expected ${test.solution}`)
  } else {
    ns.tprint(`${icon_pass} ${test.name}`)
  }
}