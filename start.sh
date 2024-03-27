#!/bin/bash
# create dirs
mkdir -p website/src/html
mkdir -p website/dist/html

# generate html files
python3 main.py load

# start node server
cd website && npm i && screen -L -Logfile ../screenlog.0 -S hack npm start
