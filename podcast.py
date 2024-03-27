import os


def download_latest_episodes():
    cmd = f"spodcast --log-level debug -c {os.getcwd()}/spodcast.json --rss-feed no --max-episodes 5 --root-path {os.getcwd()} --transcode yes https://open.spotify.com/show/7BTOsF2boKmlYr76BelijW"

    print(cmd)

    os.system(cmd)


if __name__ == "__main__":
    download_latest_episodes()

    print("Renaming files")

    audios_path = os.path.join(os.getcwd(), "Gemischtes_Hack")
    misnamed_files = [f for f in os.listdir(audios_path) if not f.startswith("Gemischtes_Hack_-_")]

    for filename in misnamed_files:
        path = os.path.join(audios_path, filename)
        new_filename = "_-_".join(filename.split("_-_")[1:])
        new_path = os.path.join(audios_path, new_filename)

        print(path)

        os.rename(path, new_path)
