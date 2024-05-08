import Document from './document';
import Stopwords from './stopwords';

export default class Corpus {
    private _stopwords: Stopwords;
    private _K1: number;
    private _b: number;
    private _documents: Map<string, Document>;
    private _collectionFrequencies: Map<string, number> | null = null;
    private _collectionFrequencyWeights: Map<string, number> | null = null;
    private _documentVectors: Map<string, Map<string, number>> | null = null;

    constructor(
        names: string[],
        texts: string[],
        useDefaultStopwords = true,
        customStopwords: string[] = [],
        K1 = 2.0,
        b = 0.75
    ) {
        this._stopwords = new Stopwords(useDefaultStopwords, customStopwords);
        this._K1 = K1;
        this._b = b;
        this._documents = new Map<string, Document>();
        names.forEach((name, i) => {
            this._documents.set(name, new Document(texts[i]));
        });
    }

    private _calculateCollectionFrequencies(): void {
        this._collectionFrequencies = new Map<string, number>();
        this._documents.forEach((document) => {
            document.getUniqueTerms().filter((t) => !this._stopwords.includes(t)).forEach((term) => {
                const currentFrequency = this._collectionFrequencies!.get(term) || 0;
                this._collectionFrequencies!.set(term, currentFrequency + 1);
            });
        });
    }

    public getTerms(): string[] {
        if (!this._collectionFrequencies) {
            this._calculateCollectionFrequencies();
        }
        return Array.from(this._collectionFrequencies!.keys());
    }

    public getCollectionFrequency(term: string): number | null {
        if (!this._collectionFrequencies) {
            this._calculateCollectionFrequencies();
        }
        return this._collectionFrequencies!.get(term) || null;
    }

    public getDocument(identifier: string): Document | undefined {
        return this._documents.get(identifier);
    }

    public getDocumentIdentifiers(): string[] {
        return Array.from(this._documents.keys());
    }

    // Adds a document to the corpus // TODO works?
    public addDocument(documentIdentifier: string, documentString: string) {
        this._documents.set(documentIdentifier, new Document(documentString));
        this._calculateCollectionFrequencies();
        this._calculateCollectionFrequencyWeights();
        this._calculateDocumentVectors();
    }

    public getDocumentVector(identifier: string): Map<string, number> | undefined {
        if (!this._documentVectors) {
            this._calculateDocumentVectors();
        }
        return this._documentVectors!.get(identifier);
    }

    private _calculateCollectionFrequencyWeights(): void {
        this._calculateCollectionFrequencies();
        this._collectionFrequencyWeights = new Map<string, number>();
        const totalDocuments = this._documents.size;
        this._collectionFrequencies!.forEach((n, term) => {
            this._collectionFrequencyWeights!.set(term, Math.log((totalDocuments + 1) / n));
        });
    }

    private _calculateDocumentVectors(): void {
        if (!this._collectionFrequencyWeights) {
            this._calculateCollectionFrequencyWeights();
        }
        this._documentVectors = new Map<string, Map<string, number>>();
        const avgLength = Array.from(this._documents.values()).reduce((acc, doc) => acc + doc.getLength(), 0) / this._documents.size;

        this._documents.forEach((document, identifier) => {
            const vector = new Map<string, number>();
            const documentLength = document.getLength();
            document.getUniqueTerms().forEach((term) => {
                const idf = this._collectionFrequencyWeights!.get(term) || 0;
                const tf = document.getTermFrequency(term);
                const tfIdf = (idf * tf * (this._K1 + 1)) / (tf + this._K1 * (1 - this._b + (this._b * documentLength) / avgLength));
                vector.set(term, tfIdf);
            });
            this._documentVectors!.set(identifier, vector);
        });
    }

    // Other methods should be updated similarly by specifying types for parameters and return values.
}