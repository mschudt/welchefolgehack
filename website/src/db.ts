import Database from "better-sqlite3"
import {Episode, TextSegment} from "./models"
import {isRunningInTSNode} from "./utils";

function database() {
    const db = new Database(
        "../db.sqlite",
        {fileMustExist: true, verbose: isRunningInTSNode ? console.log : undefined},
    );
    db.pragma('journal_mode = WAL');

    return db
}

export function loadEpisodes(): Episode[] {
    const db = database()

    const episodesData = db.prepare("SELECT * FROM episodes").all()

    const episodes: Episode[] = episodesData.map((episode: any) => {
        const segments = db.prepare("SELECT * FROM segments WHERE episode_id = ?").all(episode.id);
        // @ts-ignore
        return {...episode, segments};
    });

    // Sorting logic, adapt if needed
    return episodes.sort((a, b) => {
        const numberA = parseInt(a.title.match(/^#(\d+)/)?.[1], 10);
        const numberB = parseInt(b.title.match(/^#(\d+)/)?.[1], 10);

        return numberA - numberB || a.title.localeCompare(b.title);
    });
}

// Example usage
const episodes = loadEpisodes();
console.log(episodes);