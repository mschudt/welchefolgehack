from pydub import AudioSegment
import librosa
import soundfile as sf


def slow_down_audio_librosa(input_file, output_file, speed_factor=0.88):
    y, sr = librosa.load(input_file, sr=None)

    y_slow = librosa.effects.time_stretch(y, rate=speed_factor)

    sf.write(output_file, y_slow, sr)


audio_file_path = "253_1.wav"
output_file = "253_1_slowdown_08.wav"

slow_down_audio_librosa(audio_file_path, output_file)
