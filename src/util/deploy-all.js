import { deployLibs } from '/lib/deploy.js';
import { getAllNodes } from '/lib/map.js';

/** @param {NS} ns */
export async function main(ns) {
    const hosts = getAllNodes(ns);
    await deployLibs(ns, hosts);
}