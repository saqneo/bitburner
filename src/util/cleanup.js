/** @param {NS} ns */
export async function main(ns) {
    ns.print("Cleanup: Removing files in /tmp/...");
    const files = ns.ls("home", "/tmp/");
    for (const file of files) {
        ns.rm(file, "home");
    }
    ns.print("Cleanup: Done.");
}