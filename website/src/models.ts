export interface SearchResult {
    url: string
    name: string
    match: string
    timestamp: string
    timestampSeconds: number
    path: string
}

export interface TextSegment {
    timestamp: string
    timestampSeconds: number
    text: string
}

export interface Episode {
    title: string
    url: string
    segments: TextSegment[]
    path: string
}

export interface SearchQuery {
    s: string;
    p?: string;
    sort?: 'asc' | 'desc';
}