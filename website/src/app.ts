import cluster from "node:cluster"
import fs from "fs"
import os from "node:os"
import process from "node:process"
import path from "path"
import {performance} from "perf_hooks"
import fastify, {FastifyRequest, FastifyReply} from "fastify"
import fastifyHelmet from "@fastify/helmet"
import view from "@fastify/view"
import fastifyStatic from "@fastify/static"
import fastifyCors from "@fastify/cors"
import {JSDOM} from "jsdom"
import * as utils from "./utils"
import {SearchQuery} from "./models"

/*
TODO next up:
- navigation to episodes manually without searching priorly
- better looking 404 page
*/

// Run app in cluster mode to utilize all available cores (when running in prod).
const threads = utils.isRunningInTSNode() ? 1 : os.availableParallelism()


if (cluster.isPrimary) {
    // Primary instance setup.
    console.log(`Primary ${process.pid} is running`)

    for (let i = 0; i < threads; i++) {
        cluster.fork()
    }

    cluster.on("exit", (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died (${signal || code}). restarting...`)

        // Start a new worker if one crashed.
        cluster.fork()
    })


} else {
    setupWorkerInstance()

    console.log(`Worker ${process.pid} started`)
}

function setupWorkerInstance(): void {
    const server = fastify({
        ignoreTrailingSlash: true,
        trustProxy: true,
        logger: {
            transport: {
                target: "pino-pretty",
                options: {
                    translateTime: "yyyy-mm-dd HH:MM:ss",
                    ignore: "pid,hostname",
                },
            },
            serializers: {
                req(request) {
                    // Don't log requests of static files.
                    if (["/static/favicon.ico",
                        "/static/styles.css",
                        "/static/styles_static.css",
                        "/static/apple-touch-icon.png",
                        "/static/apple-touch-icon.png",
                        "/robots.txt",
                    ].includes(request.url)) {
                        return
                    }

                    return {
                        method: request.method,
                        url: request.url,
                        hostname: request.hostname,
                        ip: request.ip,
                    }
                }
            }
        }
    })

    server.register(fastifyHelmet, {global: true})

    server.register(fastifyCors)

// Register static file serving.
    server.register(fastifyStatic, {
        root: path.join(__dirname, "html"),
        prefix: "/",
    })

// Register static file serving.
    server.register(fastifyStatic, {
        root: path.join(__dirname, "static"),
        prefix: "/static/",
        decorateReply: false,
    })


// Register ejs template engine
    server.register(view, {
        engine: {
            ejs: require("ejs"),
        },
        templates: path.join(__dirname, "views")
    })

// Register fastify error handler
    server.setErrorHandler(function (error, request, reply) {
        if (error instanceof fastify.errorCodes.FST_ERR_BAD_STATUS_CODE) {
            reply.status(500).send({error: "Internal Server Error"})
        } else {
            reply.status(500).send({error: "Internal Server Error"})
        }

        this.log.error(error)
    })

// fastify error handler
    server.setErrorHandler((error, req, reply) => {
        if (error.statusCode === 404) {
            reply.code(404).send("Seite nicht gefunden")
        } else {
            reply.send(error)  // Default error handling
        }
    })

// Register actual routes below.

    server.get<{ Querystring: SearchQuery }>("/", (req, reply) => {
        const resultsPerPage: number = 50
        const searched: string = req.query.s
        let page: number = req.query.p ? parseInt(req.query.p) : 1

        if (isNaN(page) || page < 1) {
            page = 1
        }

        const offset: number = (page - 1) * resultsPerPage

        const startTime = performance.now()

        const sort = req.query.sort ?? "desc"

        const results = utils.search(searched, sort)
        const paginatedResults = results.slice(offset, offset + resultsPerPage)

        if (utils.isRunningInTSNode()) {
            console.log(`searched for ${searched} in ${(performance.now() - startTime).toFixed(0)} ms`)
        }

        return reply.view(
            "index.ejs", {
                results: paginatedResults,
                searched: searched,
                searchRegex: searched ? utils.getSearchRegex(searched) : null,
                page: page,
                nextPage: results.length > offset + resultsPerPage ? page + 1 : null,
                prevPage: page >= 2 ? page - 1 : null,
                totalResultsCount: results.length,
                sort: sort,
            },
        )
    })

    server.get<{
        Params: { episodeNumber: number, },
        Querystring: { s: string },
    }>("/:episodeNumber", (req, reply) => {
        const episodeNumber: number = req.params.episodeNumber

        const searched: string = req.query.s

        if (!searched) {
            reply.sendFile(`${episodeNumber}.html`)
            return
        }

        // If searched is not null, highlight the search term in the episode.
        const searchRegex: RegExp = utils.getSearchRegex(searched)

        if (!searchRegex) {
            // If there was an error when creating the regex.
            reply.sendFile(`${episodeNumber}.html`)
            return
        }

        const episodeFile: string = fs.readFileSync(
            path.join(__dirname, "html", `${episodeNumber}.html`),
            "utf16le"
        )

        // Parse pre-generated HTML site and highlight each match of the search term using regex (like in index.ejs).
        const dom = new JSDOM(episodeFile)
        const document = dom.window.document;
        const segmentElements = document.querySelectorAll('.content-text > a');

        segmentElements.forEach((element) => {
            element.innerHTML = element.innerHTML.replace(
                searchRegex,
                (match) => `<span class="highlight">${match}</span>`
            );
        });

        const updatedHtml = dom.serialize();

        reply
            .type("text/html")
            .send(updatedHtml)
    })

    server.listen({port: 3002}, async (err, address) => {
        if (err) {
            throw err
        }

        console.log(`parsing html files`)

        utils.parseEpisodes(path.join(__dirname, "html"))

        console.log(`server listening on ${address}`)
    })
}
