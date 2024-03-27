import fs from "fs"
import path from "path"
import * as cheerio from "cheerio"
import {Episode, SearchResult, TextSegment} from "./models"
import escapeStringRegexp from "escape-string-regexp"
import process from "node:process"

export let episodes: Episode[] = []

export function parseEpisodes(directory: string): Episode[] {
    const fileNames: string[] = fs.readdirSync(directory)

    fileNames.forEach((fileName) => {
        const filePath: string = path.join(directory, fileName)
        const data: string = fs.readFileSync(filePath, 'utf16le')

        const $ = cheerio.load(data)
        const title: string = $('h1').text().trim()
        const segments: TextSegment[] = []

        $('.content-box').each((index, element) => {
            const anchor = $(element).find('a').first()
            const textDiv = $(element).find('div')
            const timestampSeconds = parseInt(element.attribs['id'])

            const segment: TextSegment = {
                timestamp: anchor.text(),
                timestampSeconds: timestampSeconds,
                text: textDiv.text(),
            }

            segments.push(segment)
        })


        const episodeUrl = $("h1").parent("a").attr("href")

        const episode: Episode = {
            title,
            segments,
            url: episodeUrl,
            path: fileName.split(".html")[0],
        }


        if (isRunningInTSNode()) {
            console.log(episode.title)
        }

        episodes.push(episode)
    })

    // Sort episodes by episode number.
    episodes.sort((a, b) => {
        const numberA = parseInt(a.title.match(/^#(\d+)/)?.[1])
        const numberB = parseInt(b.title.match(/^#(\d+)/)?.[1])

        return numberA - numberB || a.title.localeCompare(b.title)
    })

    return episodes
}

function filterAlphanumeric(input: string): string {
    const pattern = /[^a-zA-Z0-9]/g
    return input.replace(pattern, '')
}

export function search(searched: string, sort: 'asc' | 'desc' = 'desc'): SearchResult[] {
    if (!searched || filterAlphanumeric(searched).length === 0) {
        return []
    }

    // ignore case, ignore whitespace
    const regex = getSearchRegex(searched)

    const results: SearchResult[] = []
    for (const episode of episodes) {
        for (let i = 0; i < episode.segments.length; i++) {
            const segment = episode.segments[i]

            let isFound
            try {
                isFound = regex.test(segment.text)
            } catch (_) {
                // probably a StackOverflow error in the regex due to length of the regex
                return []
            }

            if (!isFound) {
                continue
            }

            let textParts: string[] = []

            const maxPreSuffixLength = 200

            let prefixLength = 0
            let counter = 1
            while (prefixLength < maxPreSuffixLength && i - counter > 0) {
                const preSegment = episode.segments[i - counter].text

                textParts.push(preSegment)
                prefixLength += preSegment.length

                counter += 1
            }

            textParts.push(segment.text)


            let suffixLength = 0
            counter = 1
            while (suffixLength < maxPreSuffixLength && i + counter < episode.segments.length) {
                const postSegment = episode.segments[i + counter].text

                textParts.push(postSegment)
                suffixLength += postSegment.length

                counter += 1
            }

            textParts = ["...", ...textParts, "..."]

            const match = textParts.join(" ")

            results.push({
                url: episode.url,
                name: episode.title,
                match: match,
                timestamp: segment.timestamp,
                timestampSeconds: segment.timestampSeconds,
                path: episode.path,
            })
        }
    }

    // Sort episodes by episode number.
    results.sort((a, b) => {
        const numberA = parseInt(a.name.match(/^#(\d+)/)?.[1])
        const numberB = parseInt(b.name.match(/^#(\d+)/)?.[1])

        if (sort === "desc") {
            return numberB - numberA || a.name.localeCompare(b.name)
        } else {
            return numberA - numberB || a.name.localeCompare(b.name)
        }
    })

    return results
}

export function getSearchRegex(searched: string): RegExp | undefined {
    if (!searched) {
        return undefined
    }

    try {
        const escapedSearch = escapeStringRegexp(searched).replace(/\s*/g, "")
        const expression = escapedSearch.split("").join("\\s*")

        return new RegExp("\\b" + expression, "gi")
    } catch (_) {
        return undefined
    }
}

export function isRunningInTSNode() {
    try {
        // @ts-ignore
        return process[Symbol.for("ts-node.register.instance")]
    } catch {
        return false
    }
}