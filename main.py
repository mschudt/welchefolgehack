import os
import shutil
import sys
import time
import generate_html
from util import *
import simplejson as json
from multiprocessing import Process, Manager
from faster_whisper import WhisperModel
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
from dotenv import load_dotenv

"""
TODO feature
- report error button

TODO for opensourcing
- remove commit history
- remove/check for passwords
"""

# config
audio_dir = "Gemischtes_Hack/"
transcription_dir = "text/"
spotify_show_url = "https://open.spotify.com/show/7BTOsF2boKmlYr76BelijW"


def save(name, result):
    os.makedirs(transcription_dir, exist_ok=True)

    result_json = json.dumps(result, indent=2, iterable_as_array=True)
    with open(transcription_dir + name + ".txt", "w") as f:
        f.write(result_json)


model = None
pipeline = None

# pulled from a random episode, teaches Whisper about typical sentence structure and commonly used phrases
prompt = """Teachers asking how and why, bitches passing by, oh my he's so Gangster. Das, meine Damen und Herren, war von den Clips Youngboy von dem eins der geilsten Hip Hop Alben die je gemacht wurden, nämlich Lord Villain, checkt das unbedingt aus. Und ich widme dieses Zitat dem, den ich schätze mal Obdachlosen, der letzte Nacht sich dazu entschieden hat hier bei mir im Hausflur zu pennen, oben bei uns auf der Etage, und der hat einfach, weil ich bin neulich in Hundekacke getreten, da habe ich meine voll hundegekackten Airforce draußen stehen gehabt und sein Gangster Move war, dass er einfach die Nike Zeichen rot gemalt hat. Und damit herzlich willkommen zu einer neuen Folge Gemischtes Hack. Mein Name ist Felix Lobrecht. Mir gegenüber sitzt wie immer der wunderbare Tommi Schmitt. Tschüsseldorf. Rüssel."""


def faster_whisper_process(file_path, return_list):
    faster_model = WhisperModel(
        "large-v2",
        device="cuda",
        compute_type="float16",
        cpu_threads=6,
    )

    segments, info = faster_model.transcribe(file_path, word_timestamps=True, initial_prompt=prompt)

    print("Detected language '%s' with probability %f" % (info.language, info.language_probability))

    generated_segments = []
    for segment in segments:
        print("[%.2fs -> %.2fs] %s" % (segment.start, segment.end, segment.text))
        generated_segments.append(segment)

    return_list[0] = [generated_segments, info]


def transcribe_custom_model(file_path, model_path):
    import whisper
    import torch
    from transformers import WhisperForConditionalGeneration
    from transformers import AutoModelForSequenceClassification
    from transformers import AutoModel

    # model = whisper.load_model("large-v3", device="cuda")
    model = AutoModel.from_pretrained(".", local_files_only=True, ignore_mismatched_sizes=True)

    audio = whisper.load_audio(file_path)

    result = whisper.transcribe(model, audio, verbose=True, initial_prompt=prompt, word_timestamps=True)

    return result


def transcribe(file_path, impl="faster", return_list=None, custom_model_path=None):
    global model
    global pipeline

    if custom_model_path is not None:
        transcribe_custom_model(file_path, custom_model_path)
    elif impl == "faster":
        with Manager() as manager:
            return_list = manager.list([None])
            p = Process(target=faster_whisper_process, args=[file_path, return_list])
            p.start()
            p.join()
            p.close()

            result_object = {"segments": [s for s in return_list[0]]}

            return result_object
    elif impl == "cpp":
        from pywhispercpp.model import Model

        if model is None:
            model = Model("large")

        segments = model.transcribe(
            file_path,
            new_segment_callback=lambda x: print(f"new segment {x}"),
            speed_up=True,
        )

        return segments
    else:
        import whisper

        if model is None:
            model = whisper.load_model("large-v3", device="cuda")

        audio = whisper.load_audio(file_path)

        result = whisper.transcribe(model, audio, verbose=True, initial_prompt=prompt, word_timestamps=True)

        return result


def transcribe_loop():
    for audio_file_mp3 in os.listdir(audio_dir):
        # use only mp3 files
        if not audio_file_mp3.endswith(".mp3"):
            continue

        filename_stem = audio_file_mp3[:-4]

        # skip, if there's a corresponding file in transcription_dir
        if any(filename_stem in txt_file for txt_file in os.listdir(transcription_dir)):
            continue

        mp3_path = audio_dir + audio_file_mp3

        print(f"> [T] started: {audio_file_mp3}")

        start_time = time.time()
        try:
            result = transcribe(mp3_path, impl="faster")
        except AssertionError as exception:
            # AssertionError: Inconsistent number of segments
            print(exception)
            continue

        try:
            save(filename_stem, result)
        except Exception as ex:
            print(ex)

        runtime_seconds = time.time() - start_time

        print(
            f"> [T] finished: {audio_file_mp3}, took {ts(runtime_seconds)}")
        print("----------------\n")


def get_episodes_from_spotify_api():
    load_dotenv()

    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")

    sp = spotipy.Spotify(
        auth_manager=SpotifyClientCredentials(
            client_id=client_id,
            client_secret=client_secret,
        ),
    )

    episodes = []
    fetched_all = False
    i = 0
    while not fetched_all:
        response = sp.show_episodes(show_id=spotify_show_url, limit=50,
                                    offset=i * 50, market="de")
        episodes.extend(response['items'])

        fetched_all = len(response['items']) != 50
        i += 1

    return episodes


def copy_rf(source, destination):
    os.makedirs(source, exist_ok=True)
    os.makedirs(destination, exist_ok=True)

    for item in os.listdir(source):
        source_item = os.path.join(source, item)
        destination_item = os.path.join(destination, item)

        if os.path.isdir(source_item):
            if os.path.exists(destination_item):
                shutil.rmtree(destination_item)
            shutil.copytree(source_item, destination_item)
        else:
            shutil.copy2(source_item, destination_item)


def load(write_html_files=True):
    episodes = list(reversed(get_episodes_from_spotify_api()))
    # print(json.dumps(episodes, indent=2).encode().decode('unicode-escape'))

    results = []
    for result_file in os.listdir(transcription_dir):
        if not result_file.endswith(".txt"):
            continue

        result_path = transcription_dir + result_file
        filename_stem = result_file[:-4]

        f = open(result_path, "r")
        result_json = f.read()
        f.close()

        result = json.loads(result_json)

        results.append((filename_stem, result))

    if write_html_files:
        for result_tuple in results:
            stem = result_tuple[0]
            result = result_tuple[1]

            generate_html.html(stem, result, episodes)

        print("done. copying files from html/ to website/src/html/ now...")

        copy_rf("html/", "website/src/html/")

    return results


if __name__ == "__main__":
    arg1 = sys.argv[1]

    if arg1 == "transcribe":
        transcribe_loop()
    elif arg1 == "load":
        load()
