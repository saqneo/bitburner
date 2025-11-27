import * as map from '../lib/map.js'

/** @param {import('../..').NS} ns */
export async function main(ns) {
    backdoor(ns, ns.args[0])
}

/** @param {import('../..').NS} ns */
function backdoor(ns) {
    let routes = {}
    map.getAllNodes(ns).forEach((host) => {
        if (ns.getServer(host).backdoorInstalled) {
            return
        }

        populateRoute(ns, host, routes)
    })

    let route = routes[ns.args[0]]
    for (let i = route.length - 1; i >= 0; i--) {
    }
}

/** @param {import('../..').NS} ns */
function populateRoute(ns, host, routes) {
    if (host in routes) {
        return
    }

    if (host == 'home') {
        routes[host] = []
        return
    }

    routes[host] = [host, ...populateRoute(ns, ns.scan(host)[0])]
}
