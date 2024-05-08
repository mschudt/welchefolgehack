import * as natural from 'natural';
import {episodes, filterAlphanumeric, sortMapByKey} from "./utils";
import {Episode, SearchResult} from "./models";
import Corpus from "./nlp/corpus";
import Similarity from "./nlp/similarity";

export class DocumentSearchEngine {
    private tfidf: natural.TfIdf
    private corpus: any
    private similarity: any

    constructor() {
        this.tfidf = new natural.TfIdf()
    }

    async addEpisodes(episodes: Episode[]) {
        const keys = []
        const documents = []

        for (const episode of episodes) {

            for (const segment of episode.segments) {
                // this.tfidf.addDocument(
                //     segment.text,
                //     {episodeId: episode.id, text: segment.text}
                // )

                keys.push(`${episode.id}|${segment.text}`)
                documents.push(segment.text)
            }

        }

        this.corpus = new Corpus(keys, documents);
        this.similarity = new Similarity(this.corpus)
    }

    // TODO remove semicolons everywhere
    search(searchTerm: string): SearchResult[] {
        if (!searchTerm || filterAlphanumeric(searchTerm).length === 0) {
            return []
        }

        this.corpus.addDocument((Math.random() + 1).toString(36).substring(7), searchTerm);

        const queryVector = this.corpus.getDocumentVector(searchTerm);


        this.corpus.getDocumentIdentifiers().forEach((identifier: any) => {
            if (identifier === searchTerm) {
                return
            }
            const documentVector = this.corpus.getDocumentVector(identifier);

            const similarityScore = Similarity.cosineSimilarity(queryVector, documentVector);

            console.log(`Similarity between search query and ${identifier}: ${similarityScore}`);
        });

        return []

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

