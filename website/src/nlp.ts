import * as natural from 'natural';
import {episodes, sortMapByKey} from "./utils";
import {Episode, SearchResult} from "./models";

export class DocumentSearchEngine {
    private tfidf: natural.TfIdf

    constructor() {
        this.tfidf = new natural.TfIdf()
    }



    addEpisode(episode: Episode) {
        for (const segment of episode.segments) {
            this.tfidf.addDocument(
                segment.text,
                {episodeId: episode.id, text: segment.text}
            )
        }
    }

    // TODO remove semicolons everywhere
    search(searchTerm: string): SearchResult[] {
        let results: Map<string, any> = new Map();

        this.tfidf.tfidfs(searchTerm, (i: number, score: number, key: any) => {
            if (score > 0) {
                results.set(score.toString() + "_" + i.toString(), key)
            }
        })

        results = sortMapByKey(results)

        const searchResults: SearchResult[] = []
        for (const key of results.keys()) {
            const result = results.get(key)

            const episode = episodes.find(e => e.id === result.episodeId)
            for (let i = 0; i < episode.segments.length; i++) {
                if (episode.segments[i].text !== result.text) {
                    continue
                }
                const segment = episode.segments[i]

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
                // TODO rm key here only for debugging
                textParts = [key + "...", ...textParts, "..."]

                const match = textParts.join(" ")

                searchResults.push({
                    url: episode.url,
                    name: episode.title,
                    match: match,
                    timestamp: segment.timestamp,
                    timestampSeconds: segment.timestampSeconds,
                    path: episode.path,
                })
            }
        }

        return searchResults
    }
}

