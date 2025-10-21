import sounddevice as sd
from dataclasses import dataclass
import matplotlib.pyplot as plt
from collections import deque
import numpy as np
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
    audio_window: int = 10 

RMS_THRESHOLD = 0.02

def audio_callback(indata, frames, time, status):
    if status:
        print(status)
    display_buffer.extend(indata.copy())

    if len(display_buffer) == display_buffer.maxlen:
        full_buffer = np.concatenate(list(display_buffer))

        rms = np.sqrt(np.mean(full_buffer**2))
        print(f"Current RMS (10s window): {rms:.4f}", end='\r')
        if rms > RMS_THRESHOLD:
            print(f"\n>>> POTENTIAL EVENT detected in 10s window! RMS: {rms:.4f} <<<")


display_buffer = deque(maxlen=(AudioConfig.sample_rate*AudioConfig.audio_window)) 

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
