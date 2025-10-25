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
import os 
import threading
import queue
from pynput import keyboard

manual_capture = True

@dataclass
class AudioConfig:
    """
    Main Audio Configuration used for sounddevice parameters
    """
    sample_rate: int = 8000 
    channels: int = 1 
    dtype: str = 'float32' 
    block_size: int = 2048 
    audio_window: int = 10

RMS_THRESHOLD = 0.02


total_samples = AudioConfig.sample_rate * AudioConfig.audio_window
deque_maxlen_block = math.ceil(total_samples / AudioConfig.block_size)
display_buffer = deque(maxlen=deque_maxlen_block)

save_queue = queue.Queue()
buffer_lock = threading.Lock()

SAVE_DIR = "hardware/AI/data"

def save_worker():
    """
    Worker function to save data from the queue in a separate thread.
    """
    os.makedirs(SAVE_DIR, exist_ok=True)
    
    print("Save-worker thread started.")
    while True:
        try:
            item = save_queue.get()
            if item is None:
                break
            
            data, prefix = item
            filename = os.path.join(SAVE_DIR, f"{prefix}_time{int(time.time())}.csv")
            
            print(f"\nWorker saving to {filename}...")
            df = pd.DataFrame(data)
            df.to_csv(filename, header=False, index=False)
            print(f"Worker finished saving {filename}.")
            
            save_queue.task_done()
        except Exception as e:
            print(f"Save worker error: {e}")
            save_queue.task_done()
    print("Save-worker thread stopping.")

def audio_callback(indata: np.array, frames: int, time: Structure, status: CallbackFlags) -> None:
    """
    Callback function for sound device. Must be FAST.
    """
    if status: 
        print(status)
    
    with buffer_lock:
        display_buffer.append(indata.flatten())
        if len(display_buffer) < display_buffer.maxlen:
            return
        # Create a fast, atomic snapshot of the buffer's contents
        buffer_list_copy = list(display_buffer)
    
    # --- All expensive ops are outside the lock, using the snapshot ---
    full_buffer = np.concatenate(buffer_list_copy)
    
    window_buffered = full_buffer[-total_samples:] 

    rms = np.sqrt(np.mean(window_buffered**2))
    print(f"Current RMS ({AudioConfig.audio_window}s window): {rms:.4f}", end='\r')
    if not manual_capture:
        if rms > RMS_THRESHOLD:
            print(f"\n>>> POTENTIAL EVENT detected! RMS: {rms:.4f} <<<")
            save_queue.put((window_buffered, "rms_event"))

def on_press(key):
    """
    Callback for keyboard presses.
    """
    try:
        if key.char == 's':
            print("\n's' pressed! Queuing current buffer for manual save...")
            
            with buffer_lock:
                # Get a snapshot of the current buffer
                buffer_list_copy = list(display_buffer)
            
            if not buffer_list_copy:
                print("Buffer is empty, nothing to save.")
                return

            # Let the worker handle concatenation
            full_manual_buffer = np.concatenate(buffer_list_copy)
            save_queue.put((full_manual_buffer, "manual_save"))

    except AttributeError:
        pass # Ignore special keys
    except Exception as e:
        print(f"Keypress error: {e}")

# --- FIX: Main execution block merged into ONE try/except/finally ---

# Define listener and worker thread variables so they exist in finally
listener = None
worker_thread = None

try:
    print("Starting save-worker thread...")
    worker_thread = threading.Thread(target=save_worker, daemon=False)
    worker_thread.start()

    if manual_capture:
        print("Manual Capture Active")
        print("Starting keyboard listener...")
        listener = keyboard.Listener(on_press=on_press)
        listener.start()
        print("Press 's' to manually save the current buffer.")
    else:
        print("Automatic (RMS) mode activated")


    print("Starting audio stream...")
    
    print("Press Ctrl+C to stop the stream.")

    # Create and start the audio stream.
    with sd.InputStream(
        samplerate=AudioConfig.sample_rate, 
        channels=AudioConfig.channels, 
        callback=audio_callback,
        blocksize=AudioConfig.block_size,
        dtype=AudioConfig.dtype
    ):
        # Keep the main thread alive while the stream runs
        while True:
            time.sleep(0.1)

except KeyboardInterrupt:
    print("\nStream stopping... (Ctrl+C pressed)")
    
except Exception as e:
    print(f"An unexpected error occurred: {e}")

finally:
    print("\nShutting down...")
    if listener and listener.is_alive():
        print("Stopping keyboard listener...")
        listener.stop()
        listener.join()

    if worker_thread and worker_thread.is_alive():
        print("Sending stop signal to save-worker...")
        save_queue.put(None)
        
        print("Waiting for save-worker to finish...")
        worker_thread.join()

    print("Plotting the last captured audio from the buffer...")
    
    final_buffer_list = list(display_buffer)

    if final_buffer_list:
        full_buffer = np.concatenate(final_buffer_list)
        
        duration_s = len(full_buffer) / AudioConfig.sample_rate
        time_axis = np.linspace(0., duration_s, len(full_buffer))
        
        plt.figure(figsize=(12, 4))
        plt.plot(time_axis, full_buffer)
        plt.title("Final Audio Buffer Contents")
        plt.xlabel("Time (s)")
        plt.ylabel("Amplitude")
        plt.ylim(-1.0, 1.0)
        plt.grid(True)
        plt.tight_layout()
        plt.show()
    else:
        print("Buffer was empty, no plot to show.")
        
    print("Program exited.")