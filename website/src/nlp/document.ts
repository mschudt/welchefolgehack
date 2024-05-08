export default class Document {
    private _text: string;
    private _words: string[];
    private _termFrequencies: Map<string, number> | null = null;

    constructor(text: string) {
        this._text = text;
        this._words = text
            .match(/[a-zA-ZÀ-ÖØ-öø-ÿ]+/g) || []
            .filter((word) => word.length > 1 && !word.match(/^\d/))
            .map((word) => word.toLowerCase());
    }

    private _calculateTermFrequencies(): void {
        this._termFrequencies = new Map();
        this._words.forEach((word) => {
            const currentCount = this._termFrequencies.get(word) || 0;
            this._termFrequencies.set(word, currentCount + 1);
        });
    }

    public getTermFrequency(term: string): number | null {
        if (!this._termFrequencies) {
            this._calculateTermFrequencies();
        }
        return this._termFrequencies?.get(term) || 0;
    }

    public getText(): string {
        return this._text;
    }

    public getLength(): number {
        return this._words.length;
    }

    public getUniqueTerms(): string[] {
        if (!this._termFrequencies) {
            this._calculateTermFrequencies();
        }
        return Array.from(this._termFrequencies?.keys() || []);
    }
}