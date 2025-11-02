import sounddevice as sd
from dataclasses import dataclass
import matplotlib.pyplot as plt
from collections import deque
import numpy as np
import math
from sounddevice import CallbackFlags
from ctypes import Structure
import pandas as pd
import time

@dataclass
class AudioConfig:
    """
    Main Audio Configuration used for sounddevice parameters

    sample_rate: Sample Rate measured in Hz
    channels: Defines which audio channel being used (1=mono, 2=stereo)
    dtype: data type 
    block_size: how often callback function is called
    audio_window: size of our buffer
    """
    
    sample_rate: int = 8000 
    channels: int = 1 
    dtype: str = 'float32' 
    block_size: int = 2048 
    audio_window: int = 5


RMS_THRESHOLD = 0.02

def audio_callback(indata: np.array, frames: int, time: Structure, status: CallbackFlags) -> None:
    """
    Callback function for sound device
    Allow us to capture audio into deque

    """
    if status: 
        # see https://python-sounddevice.readthedocs.io/en/0.5.3/api/misc.html#sounddevice.CallbackFlags
        print(status)
    
    display_buffer.append(indata.flatten())

    if len(display_buffer) == display_buffer.maxlen:
        full_buffer = np.concatenate(list(display_buffer))
        window_buffered = full_buffer[-total_samples:]

        rms = np.sqrt(np.mean(window_buffered**2))
        print(f"Current RMS ({AudioConfig.audio_window}s window): {rms:.4f}", end='\r')
        if rms > RMS_THRESHOLD:
            print(f"\n>>> POTENTIAL EVENT detected in {AudioConfig.audio_window}s" 
                  f"window! RMS: {rms:.4f} <<<")
            df = pd.DataFrame(window_buffered)
            df.to_csv(f'hardware/AI/data/audio_time{time.time()}.csv',header=False,index=False)
            display_buffer.clear()


total_samples = AudioConfig.sample_rate * AudioConfig.audio_window
deque_maxlen_block = math.ceil(total_samples / AudioConfig.block_size)
display_buffer = deque(maxlen=deque_maxlen_block)

try:
    print("Starting audio stream for cough/sneeze detection...")
    print("Press Ctrl+C to stop the stream.")

    # Create and start the audio stream.
    with sd.InputStream(
        samplerate=AudioConfig.sample_rate, 
        channels=AudioConfig.channels, 
        callback=audio_callback,
        blocksize=AudioConfig.block_size,
        dtype=AudioConfig.dtype
    ):
        while True:
            time.sleep(0.1)

except KeyboardInterrupt:
    print("\nStream stopped by user.")
    if display_buffer:
        print("Plotting the last captured audio from the buffer...")
        full_buffer = np.concatenate(list(display_buffer))
        
        # Create a time axis for the plot
        duration_s = len(full_buffer) / AudioConfig.sample_rate
        time_axis = np.linspace(0., duration_s, len(full_buffer))
        
        # Create and show the plot
        plt.figure(figsize=(12, 4))
        plt.plot(time_axis, full_buffer)
        plt.title("Final Audio Buffer Contents")
        plt.xlabel("Time (s)")
        plt.ylabel("Amplitude")
        plt.ylim(-1.0, 1.0) # Audio data is typically in the range [-1.0, 1.0]
        plt.grid(True)
        plt.tight_layout()
        plt.show()
        
except Exception as e:
    print(f"An error occurred: {e}")


