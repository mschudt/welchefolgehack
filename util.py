import datetime


def ts(seconds, with_millis=False):
    duration = datetime.timedelta(seconds=seconds)
    hours, remainder = divmod(duration.seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    milliseconds_str = str(duration.microseconds * 1000)[0:2].zfill(2)

    # timestamp string like "hh:mm:ss.ms"
    timestamp = f"{hours:02}:{minutes:02}:{seconds:02}.{milliseconds_str}"

    if with_millis:
        return timestamp
    else:
        return ".".join(timestamp.split(".")[:-1])


def clean(text):
    replacements = {
        "Tommy": "Tommi",
        "Thommy": "Tommi",
        "Thommi": "Tommi",
        "Tommi Schmidt": "Tommi Schmitt",
        "Tommi Schmid": "Tommi Schmitt",
        "Lorich": "Lobrecht",
        "DIT": "dit",
        "Huggie": "Hacki",
        "Huggies": "Hackis",
        "Mischtes Hack": "Gemischtes Hack",
        "Volker Pispas": "Volker Pispers",

        # whisper hallucinations we need to get rid of
        "Untertitelung aufgrund der Amara.org-Community": "",
        "Untertitel im Auftrag des ZDF für funk, 2017": "",
        "Untertitel von Stephanie Geiges": "",
        "Untertitel der Amara.org-Community": "",
        "Untertitel im Auftrag des ZDF, 2017": "",
        "Untertitel im Auftrag des ZDF, 2020": "",
        "Untertitel im Auftrag des ZDF, 2018": "",
        "Untertitel im Auftrag des ZDF, 2021": "",
        "Untertitelung im Auftrag des ZDF, 2021": "",
        "Copyright WDR 2021": "",
        "Copyright WDR 2020": "",
        "Copyright WDR 2019": "",
        "SWR 2021": "",
        "SWR 2020": "",
    }

    text = text.strip()

    for r in replacements:
        text = text.replace(r, replacements[r])

    return text
