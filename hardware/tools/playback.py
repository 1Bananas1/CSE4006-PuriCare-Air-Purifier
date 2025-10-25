import sounddevice as sd
import numpy as np
import pandas as pd


sample_rate: int = 8000
dtype: str = 'float32'
csv_filename: str = 'my_audio.csv' # put relative path here


print(f"Loading audio from {csv_filename}...")
try:
    my_audio_data = pd.read_csv(
        csv_filename, 
        header=None
    ).iloc[:, 0].to_numpy(dtype=dtype)

    print(f"Loaded {my_audio_data.shape[0]} samples.")
    print("Playing audio...")
    sd.play(my_audio_data, sample_rate)
    sd.wait()

    print("Playback finished.")

except FileNotFoundError:
    print(f"Error: '{csv_filename}' not found.")
except pd.errors.EmptyDataError:
    print(f"Error: '{csv_filename}' is empty.")
except Exception as e:
    print(f"An error occurred: {e}")