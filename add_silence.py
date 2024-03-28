from pydub import AudioSegment
import pydub
import json
import os

audio_file_path = '253_1.wav'
audio = AudioSegment.from_wav(audio_file_path)

with open("text/Gemischtes_Hack_-_253_JURASSIC_QUARK.txt", "r") as f:
    content = f.read()

text_json = json.loads(content)
transcript_segments = text_json["segments"][0]

transcript_segments.sort(key=lambda x: x['end'])

# Add silence at the end of each segment
silence_duration = 2000
new_audio_parts = []

for segment in transcript_segments:
    # Convert end time to milliseconds
    if segment['end'] > len(audio) / 1000:
        break

    start_time_ms = int(segment['start'] * 1000)
    end_time_ms = int(segment['end'] * 1000)

    # Extract the audio up to this segment's end
    segment_audio = audio[start_time_ms:end_time_ms]

    # Add the segment audio to the list
    new_audio_parts.append(segment_audio)

    # Add silence after this segment
    new_audio_parts.append(AudioSegment.silent(duration=silence_duration))

# Concatenate all parts together
modified_audio = sum(new_audio_parts)

# Export the modified audio file
modified_audio.export("253_1_silence.wav", format="wav")

print("Modified audio file has been created.")
