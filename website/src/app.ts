import cluster from "node:cluster"
import os from "node:os"
import process from "node:process"
import * as utils from "./utils"
import {worker} from "./worker"

/*
TODO next up:
- navigation to episodes manually without searching priorly
*/

// Run app in cluster mode to utilize all available cores (when running in prod).
const threads = utils.isRunningInTSNode() ? 1 : os.availableParallelism()


if (cluster.isPrimary) {
    // Primary instance setup.
    console.log(`Primary ${process.pid} is running`)

    // Start worker instances.
    for (let i = 0; i < threads; i++) {
        cluster.fork()
    }

    cluster.on("exit", (worker, code, signal) => {
        console.error(`worker ${worker.process.pid} died (${signal || code}). restarting...`)

        // Start a new worker if one crashed.
        cluster.fork()
    })

} else {
    worker()
    console.log(`Worker ${process.pid} started`)
}

