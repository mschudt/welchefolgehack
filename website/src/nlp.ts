import {episodes, filterAlphanumeric, sortMapByKey} from "./utils";
import {Episode, SearchResult} from "./models";
import * as fs from 'fs';

export class DocumentSearchEngine {
    private extractor: any // TODO typing
    private corpus: any
    private cos_sim: any
    private initialising: boolean = false

    constructor() {
        this.corpus = {}
    }

    async initialise(episodes: any) {
        if (this.initialising) {
            return;
        }
        this.initialising = true;

        const transformers = await Function('return import("@xenova/transformers")')();
        const {pipeline} = transformers;
        this.cos_sim = transformers.cos_sim;

        this.extractor = await pipeline('feature-extraction', 'Xenova/bert-base-uncased', {revision: 'default'});

        // list every file in jsons subdir and parse the json into the corpus object in the same structure as the write
        const jsons = fs.readdirSync("jsons");
        const readAndParsePromises = jsons.map(async (json) => {
            const data = await fs.promises.readFile(`jsons/${json}`, "utf8");
            this.corpus[json.split(".")[0]] = JSON.parse(data);
            console.log(`${json}`)
        });
        await Promise.all(readAndParsePromises);

        console.log("corpus loaded");

        return;
        // TODO refactor

        await Promise.all(episodes.map(async (episode: any) => {
            this.corpus[episode.id] = [];
            console.log(episode);

            // Prepare batches of promises for parallel execution
            const segmentPromises = episode.segments.map((segment: any) => this.extractor(segment.text, {
                    pooling: 'mean',
                    normalize: true
                })
                    .then((output: { data: any; }) => {
                        this.corpus[episode.id].push([segment, output.data]);
                    })
            );

            // Execute segment processing in parallel with a concurrency limit
            await this.processInBatches(segmentPromises, 8);
        }));

        console.log("corpus loaded");

        Object.keys(this.corpus).forEach(
            (k) => fs.writeFileSync(`${k}.json`, JSON.stringify(this.corpus[k]), "utf8")
        )
    }

    async processInBatches(promises: any, batchSize: number) {
        for (let i = 0; i < promises.length; i += batchSize) {
            const batchPromises = promises.slice(i, i + batchSize);
            await Promise.all(batchPromises);
        }
    }

    async search(searchTerm: string): Promise<SearchResult[]> {
        if (!searchTerm || filterAlphanumeric(searchTerm).length === 0) {
            return []
        }

        const searchTermOutput = await this.extractor(searchTerm, {pooling: 'mean', normalize: true});

        let results: Map<string, any> = new Map();

        for (const episodeId of Object.keys(this.corpus)) {
            const value = this.corpus[episodeId]
            for (let i = 0; i < value.length; i++) {
                const segment = value[i][0]
                const segmentOutput = new Float32Array(Object.keys(value[i][1]).map(k => value[i][1][k]))

                const score = this.cos_sim(searchTermOutput.data, segmentOutput)

                if (score > 0.5) {
                    results.set(score.toString() + "_" + i.toString(), {episodeId: episodeId, text: segment.text})
                }
            }
        }

        results = sortMapByKey(results)

        let counter = 0
        const searchResults: SearchResult[] = []
        for (const key of results.keys()) {
            if (counter > 500) {
                break
            }
            counter += 1

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

