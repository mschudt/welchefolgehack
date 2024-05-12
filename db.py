import sqlite3
from util import *

conn = sqlite3.connect("db.sqlite")
c = conn.cursor()


# Create tables
def ensure_structure():
    c.execute(
        """CREATE TABLE IF NOT EXISTS episodes (id INTEGER PRIMARY KEY, episode_number INTEGER, title TEXT, url TEXT, path TEXT)"""
    )
    c.execute(
        """CREATE TABLE IF NOT EXISTS segments
                 (id INTEGER PRIMARY KEY, episode_id INTEGER, start_seconds INTEGER, timestamp TEXT, text TEXT, FOREIGN KEY (episode_id) REFERENCES episodes(id))"""
    )
    conn.commit()


def insert_episode(episode_number, title, url, path):
    c.execute("INSERT OR IGNORE INTO episodes (episode_number, title, url, path) VALUES (?, ?, ?, ?)",
              (episode_number, title, url, path))
    conn.commit()
    return c.lastrowid


def write_to_db(episode_nr, episode_name, episode_url, url_path, segments):
    episode_id = insert_episode(episode_nr, episode_name, episode_url, url_path)

    if isinstance(segments[0], list):
        segments = segments[0]

    segments_data = [
        (
            episode_id,
            int(segment['start']),
            ts(int(segment['start'])),
            clean(segment['text']),
        )
        for segment in segments
    ]

    insert_segments(segments_data)


def insert_segments(segment_data):
    c.executemany(
        "INSERT OR IGNORE INTO segments (episode_id, start_seconds, timestamp, text) VALUES (?, ?, ?, ?)",
        segment_data
    )
    conn.commit()
