import {episodes, filterAlphanumeric, sortMapByKey} from "./utils";
import {Episode, SearchResult} from "./models";
import * as fs from 'fs';

export class DocumentSearchEngine {
    private extractor: any // TODO typing
    private corpus: any
    private cos_sim: any

    constructor() {
        this.corpus = {}
    }

    async initialise(episodes: Episode[]) {
        const transformers = await Function('return import("@xenova/transformers")')();
        const {pipeline, cos_sim, extractor} = transformers;
        this.cos_sim = cos_sim;

        this.extractor = await pipeline('feature-extraction', 'Xenova/bert-base-uncased', {revision: 'default'});

        for (const episode of episodes) {
            this.corpus[episode.id] = []
            console.log(episode)

            for (const segment of episode.segments) {
                const output = await this.extractor(segment.text, {pooling: 'mean', normalize: true});
                this.corpus[episode.id].push([segment, output.data])
            }
        }
        console.log("corpus loaded")
        fs.writeFileSync('corpus.json', JSON.stringify(this.corpus), 'utf8');
    }

    // TODO remove semicolons everywhere
    async search(searchTerm: string): Promise<SearchResult[]> {
        if (!searchTerm || filterAlphanumeric(searchTerm).length === 0) {
            return []
        }

        const searchTermOutput = await this.extractor(searchTerm, {pooling: 'mean', normalize: true});

        let results: Map<string, any> = new Map();

        for (const episodeId of this.corpus.keys()) {
            const value = this.corpus[episodeId]
            for (let i = 0; i < value.length; i++) {
                const segment = value[i][0]
                const segmentOutput = value[i][1]

                const score = this.cos_sim(searchTermOutput, segmentOutput)

                if (score > 0) {
                    results.set(score.toString() + "_" + i.toString(), {episodeId: episodeId, text: segment.text})
                }
            }
        }

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

