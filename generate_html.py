import os
from util import *
import re

html_template = """
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <title>{{title}}</title>
    <link rel="icon" type="icon" href="/static/favicon.ico">
    <link rel="stylesheet" href="/static/styles_static.css">
</head>
<body id="{{urlPath}}">
    <div class="container">
        <a class="back-button" href="/">Zurück zur Startseite</a>
        <a href="{{episodeUrl}}">
            <h1 class="content-title">{{heading}}</h1>
        </a>
        <div class="content-wrapper">
            {{items}}
        </div>
    </div>
</body>
</html>
"""


def write_html_files(episode_nr, episode_name, episode_url, url_path, segments):
    html_dir = "html/"
    os.makedirs(html_dir, exist_ok=True)

    items = []
    # convert faster-whisper format
    if isinstance(segments[0], list):
        segments = segments[0]

    for segment in segments:
        cleaned_text = clean(segment['text'])

        items.append({
            "start": int(segment['start']),
            "link": f"{episode_url}?t={int(segment['start'])}",
            "timestamp": ts(segment["start"]),
            "text": cleaned_text,
        })

    item_html = ""
    for item in items:
        item_html += f"""
            <div class="content-box" id="{item["start"]}">
                <span class="content-title"><a href="{item["link"]}">{item["timestamp"]}</a></span>
                <div class="content-text"><a href="{item["link"]}">{item["text"]}</a></div>
            </div>
        """
    html_page = html_template

    html_title = f"{episode_name}"
    html_heading = f"{episode_name}"

    html_page = html_page.replace("{{title}}", html_title)
    html_page = html_page.replace("{{urlPath}}", url_path)
    html_page = html_page.replace("{{episodeUrl}}", episode_url)
    html_page = html_page.replace("{{heading}}", html_heading)
    html_page = html_page.replace("{{items}}", item_html)

    with open(html_dir + f"{url_path}.html", "w", encoding="UTF-16") as f:
        f.write(html_page)
