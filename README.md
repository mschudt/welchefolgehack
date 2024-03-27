# welchefolgehack.de

Durchsuche alle Folgen Gemischtes Hack von Felix Lobrecht und Tommi Schmitt.

Alle Folgen in Textform auf [welchefolgehack.de](https://welchefolgehack.de).

## Voraussetzungen

- `ffmpeg`
- CUDA
- `torch` Version passend zur CUDA-Installation (`nvcc --version`)

[PyTorch Documentation](https://pytorch.org/get-started/locally), um die richtige `torch` Version zu finden.

## Installation

```shell
pip install -r requirements.txt
```

## Ausführen

```shell
# neue Folgen runterladen
python3 podcast.py

# neue Folgen transkribieren
python3 main.py transcribe

# HTML Dateien aus trankribierten Texten generieren
python3 main.py load

# Webseite im dev mode starten
cd website
npm i
npm run run
```