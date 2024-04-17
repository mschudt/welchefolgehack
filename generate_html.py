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


def clean_str_for_path(string):
    return re.sub(r"[^a-zA-Z0-9\-_./\\]", "", string)


def clean_for_match(input_string):
    umlaute_map = {
        ord("ä"): "a", ord("ü"): "u", ord("ö"): "o", ord("Ä"): "A", ord("Ü"): "U", ord("Ö"): "O",
        ord("ß"): "", ord("ẞ"): "", ord("?"): "", ord("!"): "", ord("'"): ""
    }

    cleaned_string = ""
    for char in input_string.strip().translate(umlaute_map):
        if char.isalnum() or char in [" ", "-", "_", "."]:
            cleaned_string += char

    return cleaned_string.strip()


def html(name, result, episodes):
    episode_name = " ".join(name.split("Gemischtes_Hack_-_")[1].split("_")[1:]).strip()

    episode_obj = next((e for e in episodes if clean_for_match(e["name"]).endswith(episode_name)), None)

    if episode_obj is None:
        print(f"> [!] could not find episode {episode_name} in episodes!")
        return

    episode_nr = name.split("Gemischtes_Hack_-_")[1].split("_")[0]
    episode_name = episode_obj["name"]
    episode_url = episode_obj["external_urls"]["spotify"]

    html_dir = "html/"
    os.makedirs(html_dir, exist_ok=True)

    items = []
    segments = result["segments"]
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

    url_path = episode_nr if "#" in episode_name else clean_str_for_path(episode_name.replace(" ", "_").lower())

    html_title = f"{episode_name}"
    html_heading = f"{episode_name}"

    html_page = html_page.replace("{{title}}", html_title)
    html_page = html_page.replace("{{urlPath}}", url_path)
    html_page = html_page.replace("{{episodeUrl}}", episode_url)
    html_page = html_page.replace("{{heading}}", html_heading)
    html_page = html_page.replace("{{items}}", item_html)

    with open(html_dir + f"{url_path}.html", "w", encoding="UTF-16") as f:
        f.write(html_page)
