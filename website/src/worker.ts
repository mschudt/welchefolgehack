import fastify, {FastifyInstance, FastifyReply} from "fastify"
import fastifyHelmet from "@fastify/helmet"
import fastifyStatic from "@fastify/static"
import fastifyCors from "@fastify/cors"
import view from "@fastify/view"
import path from "path"
import fs from "fs"
import {performance} from "perf_hooks"
import {JSDOM} from "jsdom"
import * as utils from "./utils"
import {SearchQuery} from "./models"
import process from "node:process"


export function worker(): void {
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

    registerMiddleware(server)

    registerRoutes(server)

    // Start worker server.
    server.listen({port: 3002}, async (err, address) => {
        if (err) {
            throw err
        }

        console.log(`[${process.pid}] parsing html files`)

        await utils.parseEpisodes(path.join(__dirname, "html"))

        console.log(`[${process.pid}] server listening on ${address}`)
    })
}

/** Register all registerRoutes of the site. */
function registerRoutes(server: FastifyInstance): void {
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
}

function registerMiddleware(server: FastifyInstance): void {
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

    // Register ejs template engine.
    server.register(view, {
        engine: {
            ejs: require("ejs"),
        },
        templates: path.join(__dirname, "views")
    })

    // Error handler.
    server.setErrorHandler((error, request, reply) => {
        console.error(error)
        reply.view("error.ejs")
    })

    // 404 error handler.
    server.setNotFoundHandler((request, reply) => {
            console.error(`404 Page not found: ${request}`)
            reply.view("error.ejs")
        }
    )
}