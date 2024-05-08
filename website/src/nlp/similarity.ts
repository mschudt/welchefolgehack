import Corpus from './corpus';

export default class Similarity {
    private _corpus: Corpus;
    private _distanceMatrix: { identifiers: string[]; matrix: number[][] } | null = null;

    constructor(corpus: Corpus) {
        this._corpus = corpus;
    }

    static cosineSimilarity(vector1: Map<string, number>, vector2: Map<string, number>): number {
        const v1 = Array.from(vector1.values());
        const v2 = Array.from(vector2.values());
        let dotProduct = 0.0;
        let ss1 = 0.0;
        let ss2 = 0.0;
        const length = Math.min(v1.length, v2.length);
        for (let i = 0; i < length; i++) {
            if (v1[i] === 0 && v2[i] === 0) continue;
            dotProduct += v1[i] * v2[i];
            ss1 += v1[i] * v1[i];
            ss2 += v2[i] * v2[i];
        }
        const magnitude = Math.sqrt(ss1) * Math.sqrt(ss2);
        return magnitude ? dotProduct / magnitude : 0.0;
    }

    private _calculateDistanceMatrix(): void {
        const identifiers = this._corpus.getDocumentIdentifiers();
        const vectors = identifiers.map((d: any) => this._corpus.getDocumentVector(d));
        const matrix = new Array(vectors.length)
            .fill(null)
            .map(() => new Array(vectors.length).fill(0));
        for (let i = 0; i < vectors.length; i++) {
            for (let j = i; j < vectors.length; j++) {
                if (i === j) {
                    matrix[i][j] = 0.0;
                } else {
                    matrix[i][j] = 1.0 - Similarity.cosineSimilarity(vectors[i], vectors[j]);
                    matrix[j][i] = matrix[i][j]; // the matrix is symmetric
                }
            }
        }
        this._distanceMatrix = { identifiers, matrix };
    }

    public getDistanceMatrix(): { identifiers: string[]; matrix: number[][] } | null {
        if (!this._distanceMatrix) {
            this._calculateDistanceMatrix();
        }
        return this._distanceMatrix;
    }
}