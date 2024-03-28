import json
import whisperx
from pydub import AudioSegment
import os
import gc
# import torch
import pandas as pd
from dotenv import load_dotenv

def my_assign_word_speakers(diarize_df, transcript_result, fill_nearest=False):
    import numpy as np

    transcript_segments = transcript_result["segments"]
    for seg in transcript_segments:
        if "Ich stimme irgendwo ein" in seg["text"]:
            print(seg)

        # assign speaker to segment (if any)
        diarize_df['intersection'] = np.minimum(diarize_df['end'], seg['end']) - np.maximum(diarize_df['start'],
                                                                                            seg['start'])
        diarize_df['union'] = np.maximum(diarize_df['end'], seg['end']) - np.minimum(diarize_df['start'], seg['start'])
        # remove no hit, otherwise we look for closest (even negative intersection...)
        if not fill_nearest:
            dia_tmp = diarize_df[diarize_df['intersection'] > 0]
        else:
            dia_tmp = diarize_df
        if len(dia_tmp) > 0:
            # sum over speakers
            speaker = dia_tmp.groupby("speaker")["intersection"].sum().sort_values(ascending=False).index[0]
            seg["speaker"] = speaker

        # assign speaker to words
        if 'words' in seg:
            for word in seg['words']:
                if 'start' in word:
                    diarize_df['intersection'] = np.minimum(diarize_df['end'], word['end']) - np.maximum(
                        diarize_df['start'], word['start'])
                    diarize_df['union'] = np.maximum(diarize_df['end'], word['end']) - np.minimum(diarize_df['start'],
                                                                                                  word['start'])
                    # remove no hit
                    if not fill_nearest:
                        dia_tmp = diarize_df[diarize_df['intersection'] > 0]
                    else:
                        dia_tmp = diarize_df
                    if len(dia_tmp) > 0:
                        # sum over speakers
                        speaker = dia_tmp.groupby("speaker")["intersection"].sum().sort_values(ascending=False).index[0]
                        word["speaker"] = speaker

    return transcript_result


def save_diarized_segments(audio_path, diarize_df, output_dir="audio_segs_shifted"):
    # Load the full audio file
    audio = AudioSegment.from_file(audio_path)

    # Ensure the output directory exists
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Iterate over the diarization DataFrame and save each segment
    for index, row in diarize_df.iterrows():
        start_ms = row['start'] * 1000  # Convert start time to milliseconds
        end_ms = row['end'] * 1000  # Convert end time to milliseconds
        segment_audio = audio[start_ms:end_ms]  # Extract the segment

        # Create a filename for the segment
        segment_filename = f"{os.getcwd()}/{output_dir}/{index}_{row['start']}_{row['end']}_{row['speaker']}.wav"

        # Export the segment to a file
        segment_audio.export(segment_filename, format="wav")
        print(f"Segment saved: {segment_filename}")


def find_longest_common_streak(s1, s2):
    """Find the longest common streak of words between s1 and s2."""
    words1 = s1.split()
    words2 = s2.split()
    m = len(words1)
    n = len(words2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]  # Matrix to store lengths of longest common streaks
    longest_len = 0  # Length of the longest common streak

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if words1[i - 1] == words2[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
                longest_len = max(longest_len, dp[i][j])
            else:
                dp[i][j] = 0
    return longest_len


def find_closest_string(target, string_list):
    """Find the string in the list that contains the longest common streak of words from target."""
    max_length = -1
    closest_string = None

    for s in string_list:
        common_length = find_longest_common_streak(target, s)
        if common_length > max_length:
            max_length = common_length
            closest_string = s

    return closest_string


device = "cuda"
batch_size = 4
compute_type = "float16"
language = "de"

audio_file = "253_1.wav"
audio = whisperx.load_audio(audio_file)

# model = whisperx.load_model("large-v2", device=device, compute_type=compute_type, language=language)
# result_whisperx = model.transcribe(audio, batch_size=batch_size, language=language)
# del model
# gc.collect()
# torch.cuda.empty_cache()

# 2. Align whisper output
# model_a, metadata = whisperx.load_align_model(language_code="de", device=device)
# result_align = whisperx.align(result_whisperx["segments"], model_a, metadata, audio, device,
#                               return_char_alignments=False)
# text_segments = result_align

# load transcript json
with open("text/Gemischtes_Hack_-_253_JURASSIC_QUARK.txt", "r") as f:
    content = f.read()

text_json = json.loads(content)
text_segments = text_json["segments"][0]
text_segments = {"segments": text_segments}

# load_dotenv()
# hf_auth_token = os.getenv("HF_AUTH_TOKEN")
# diarize_model = whisperx.DiarizationPipeline(
#     use_auth_token=hf_auth_token,
#     device=device
# )
# diarize_segments = diarize_model(audio, num_speakers=2)
#
# # text_segments = result_align
# diarize_segments.to_csv('diarize_segments.csv', index=False)

diarize_segments = pd.read_csv('diarize_segments.csv')

my_assign_word_speakers(diarize_segments, text_segments, fill_nearest=False)

save_diarized_segments(audio_file, diarize_segments, output_dir="audio_segs")

print(diarize_segments)

for s in text_segments["segments"]:
    speaker = s.get("speaker")

    if speaker is None:
        speaker = "Unknown"
    else:
        speaker = "Felix" if s.get("speaker") == "SPEAKER_00" else "Tommi"

    if s["start"] > 200:
        break

    print(f"[{s['start']}:{s['end']}]\t=> {speaker}:\t{s['text']}")

# for ds in diarize_segments:
#     print(f"[{ds['start']}:{ds['end']}]\t=> {ds['speaker']}")

for i in range(len(diarize_segments.to_dict()["segment"])):
    dia_seg = diarize_segments.iloc[i].to_dict()
    # print(f"[{dia_seg['start']}:{dia_seg['end']}]\t=> {dia_seg['speaker']}")
    word_hash = None
    start_word = None
    is_break = False
    for seg in text_segments["segments"]:
        for word in seg["words"]:
            if word["start"] >= dia_seg["start"]:
                # print(f"START {word['start']} >= {dia_seg['start']}")
                # print(f"=> {word["word"]} => {word.get('speaker')}\n")
                word_hash = hash(str(word))
                start_word = word["word"]
                is_break = True
                break

        if is_break:
            break

    started = False

    word_list = []
    segments_list = []

    is_break = False
    for seg in text_segments["segments"]:
        for word in seg["words"]:
            if not started and hash(str(word)) != word_hash:
                continue

            started = True

            if word["end"] >= dia_seg["end"]:
                # print(f"END {word['end']} >= {dia_seg['end']}")
                # print(f"=> {word["word"]} => {word.get('speaker')}\n")
                is_break = True
                break

            word_list.append(word["word"])

        if started:
            segments_list.append(seg)

        if is_break:
            # print(word_list)

            target = " ".join([w.strip() for w in word_list])

            string_list = []
            n_started = False
            for ns in (s["text"] for s in text_segments["segments"]):
                if n_started or ns == segments_list[0]["text"]:
                    n_started = True

                if n_started:
                    string_list.append(ns)

            closest_string = find_closest_string(target, string_list)
            print(f"{closest_string} => {dia_seg['speaker']}")

            word_list = []
            segments_list = []

            break

print()
print()
