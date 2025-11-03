import os
import sys
import math
import json
import time
import glob
import random
import argparse
from pathlib import Path
from typing import List, Tuple, Dict

import numpy as np
import librosa
import soundfile as sf  # ensures librosa can read most formats

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
from sklearn.metrics import classification_report, confusion_matrix

# -----------------------------
# Utils
# -----------------------------

def set_seed(seed: int = 1337):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def ensure_dir(p: str):
    Path(p).mkdir(parents=True, exist_ok=True)


def list_audio_files(folder: str) -> List[str]:
    exts = ["*.wav", "*.mp3", "*.flac", "*.m4a", "*.ogg"]
    files = []
    for e in exts:
        files.extend(glob.glob(os.path.join(folder, e)))
    return sorted(files)


# -----------------------------
# Dataset
# -----------------------------
class AudioDataset(Dataset):
    def __init__(
        self,
        root: str,
        split: str,
        sr: int = 8000,
        n_mels: int = 64,
        duration: float = 2.0,
        hop_length: int = 128,
        fmin: int = 20,
        fmax: int = None,
        augment: bool = False,
        class_names: List[str] = None,
    ):
        self.root = root
        self.split = split
        self.sr = sr
        self.n_mels = n_mels
        self.duration = duration
        self.hop_length = hop_length
        self.fmin = fmin
        self.fmax = fmax
        self.augment = augment

        # discover classes if not given
        if class_names is None:
            split_dir = os.path.join(root, split)
            class_names = [d for d in os.listdir(split_dir) if os.path.isdir(os.path.join(split_dir, d))]
        # normalize class names and stable order
        class_names = sorted(class_names)
        self.class_names = class_names
        self.class_to_idx = {c: i for i, c in enumerate(class_names)}

        # index files
        self.items = []
        for c in class_names:
            cdir = os.path.join(root, split, c)
            for fp in list_audio_files(cdir):
                self.items.append((fp, self.class_to_idx[c]))

        self.samples_per_clip = int(round(self.duration * self.sr))
        if self.fmax is None:
            self.fmax = self.sr // 2

    def __len__(self):
        return len(self.items)

    def _load_audio(self, path: str) -> np.ndarray:
        y, sr = librosa.load(path, sr=self.sr, mono=True)
        return y

    def _random_gain(self, y: np.ndarray) -> np.ndarray:
        # +/- 6 dB
        if not self.augment:
            return y
        gain_db = np.random.uniform(-6.0, 6.0)
        gain = 10 ** (gain_db / 20)
        return y * gain

    def _random_time_shift(self, y: np.ndarray) -> np.ndarray:
        if not self.augment:
            return y
        max_shift = int(0.1 * self.sr)  # up to 100 ms
        shift = np.random.randint(-max_shift, max_shift + 1)
        return np.roll(y, shift)

    def _random_crop_or_pad(self, y: np.ndarray) -> np.ndarray:
        N = self.samples_per_clip
        if len(y) < N:
            pad = N - len(y)
            y = np.pad(y, (0, pad), mode="constant")
        elif len(y) > N:
            if self.augment:
                start = np.random.randint(0, len(y) - N + 1)
            else:
                start = (len(y) - N) // 2
            y = y[start:start + N]
        return y

    def _mel_spectrogram(self, y: np.ndarray) -> np.ndarray:
        S = librosa.feature.melspectrogram(
            y=y,
            sr=self.sr,
            n_fft=2048,
            hop_length=self.hop_length,
            n_mels=self.n_mels,
            fmin=self.fmin,
            fmax=self.fmax,
            power=2.0,
            center=True,
        )
        S_db = librosa.power_to_db(S, ref=np.max)
        return S_db

    def _spec_augment(self, M: np.ndarray) -> np.ndarray:
        if not self.augment:
            return M
        M = M.copy()
        # time mask
        T = M.shape[1]
        num_tm = 1
        max_t = max(1, T // 12)
        for _ in range(num_tm):
            t = np.random.randint(1, max_t + 1)
            t0 = np.random.randint(0, max(1, T - t))
            M[:, t0:t0 + t] = M.mean()
        # freq mask
        Fm = M.shape[0]
        num_fm = 1
        max_f = max(1, Fm // 12)
        for _ in range(num_fm):
            f = np.random.randint(1, max_f + 1)
            f0 = np.random.randint(0, max(1, Fm - f))
            M[f0:f0 + f, :] = M.mean()
        return M

    def __getitem__(self, idx: int):
        path, label = self.items[idx]
        y = self._load_audio(path)
        y = self._random_gain(y)
        y = self._random_time_shift(y)
        y = self._random_crop_or_pad(y)
        M = self._mel_spectrogram(y)
        M = self._spec_augment(M)
        # normalize per-sample: zero mean / unit var
        mu, sigma = np.mean(M), np.std(M) + 1e-6
        M = (M - mu) / sigma
        # to tensor [1, n_mels, time]
        T = torch.tensor(M, dtype=torch.float32).unsqueeze(0)
        return T, label


# -----------------------------
# Model
# -----------------------------
class ConvBlock(nn.Module):
    def __init__(self, in_ch, out_ch, k=3, p=1):
        super().__init__()
        self.conv = nn.Conv2d(in_ch, out_ch, kernel_size=k, padding=p, bias=False)
        self.bn = nn.BatchNorm2d(out_ch)
        self.act = nn.ReLU(inplace=True)

    def forward(self, x):
        return self.act(self.bn(self.conv(x)))


class SmallCNN(nn.Module):
    def __init__(self, n_classes: int):
        super().__init__()
        self.layer1 = nn.Sequential(
            ConvBlock(1, 16),
            nn.MaxPool2d((2, 2)),
            nn.Dropout(0.1),
        )
        self.layer2 = nn.Sequential(
            ConvBlock(16, 32),
            nn.MaxPool2d((2, 2)),
            nn.Dropout(0.15),
        )
        self.layer3 = nn.Sequential(
            ConvBlock(32, 64),
            nn.MaxPool2d((2, 2)),
            nn.Dropout(0.2),
        )
        self.gap = nn.AdaptiveAvgPool2d((1, 1))
        self.head = nn.Linear(64, n_classes)

    def forward(self, x):
        x = self.layer1(x)
        x = self.layer2(x)
        x = self.layer3(x)
        x = self.gap(x).flatten(1)
        logits = self.head(x)
        return logits


# -----------------------------
# Training / Eval
# -----------------------------

def discover_classes(data_root: str) -> List[str]:
    # infer classes from train split
    train_dir = os.path.join(data_root, "train")
    classes = [d for d in os.listdir(train_dir) if os.path.isdir(os.path.join(train_dir, d))]
    classes = sorted(classes)
    return classes


def compute_class_weights(dataset: AudioDataset) -> torch.Tensor:
    counts = {i: 0 for i in range(len(dataset.class_names))}
    for _, y in dataset.items:
        counts[y] += 1
    total = sum(counts.values())
    weights = []
    for i in range(len(dataset.class_names)):
        c = counts[i]
        w = total / (c + 1e-9)
        weights.append(w)
    weights = np.array(weights)
    weights = weights / weights.mean()
    return torch.tensor(weights, dtype=torch.float32)


def make_loaders(data_root: str, sr: int, n_mels: int, duration: float, hop_length: int,
                 batch: int, augment: bool) -> Tuple[DataLoader, DataLoader, List[str]]:
    classes = discover_classes(data_root)
    train_ds = AudioDataset(data_root, 'train', sr, n_mels, duration, hop_length, augment=augment, class_names=classes)
    val_ds   = AudioDataset(data_root, 'val',   sr, n_mels, duration, hop_length, augment=False, class_names=classes)

    # Weighted sampler to combat imbalance
    class_weights = compute_class_weights(train_ds)
    sample_weights = [class_weights[y].item() for _, y in train_ds.items]
    sampler = WeightedRandomSampler(sample_weights, num_samples=len(sample_weights), replacement=True)

    train_loader = DataLoader(train_ds, batch_size=batch, sampler=sampler, num_workers=2, pin_memory=True)
    val_loader   = DataLoader(val_ds,   batch_size=batch, shuffle=False, num_workers=2, pin_memory=True)
    return train_loader, val_loader, classes


def train(args):
    device = torch.device('cuda' if torch.cuda.is_available() and not args.cpu else 'cpu')
    set_seed(args.seed)

    train_loader, val_loader, classes = make_loaders(
        data_root=args.data,
        sr=args.sr,
        n_mels=args.n_mels,
        duration=args.duration,
        hop_length=args.hop_length,
        batch=args.batch,
        augment=True,
    )

    model = SmallCNN(n_classes=len(classes)).to(device)
    print(f"Model: SmallCNN, classes={classes}")

    # class-weighted CE
    cw = compute_class_weights(val_loader.dataset).to(device)
    criterion = nn.CrossEntropyLoss(weight=cw)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, factor=0.5, patience=3)

    best_val = float('inf')
    best_path = args.model_out
    ensure_dir(os.path.dirname(best_path))

    for epoch in range(1, args.epochs + 1):
        model.train()
        t0 = time.time()
        train_loss = 0.0
        n = 0
        for xb, yb in train_loader:
            xb = xb.to(device)
            yb = yb.to(device)
            optimizer.zero_grad(set_to_none=True)
            logits = model(xb)
            loss = criterion(logits, yb)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 5.0)
            optimizer.step()
            train_loss += loss.item() * xb.size(0)
            n += xb.size(0)
        train_loss /= max(1, n)

        # validation
        model.eval()
        val_loss = 0.0
        m = 0
        with torch.no_grad():
            for xb, yb in val_loader:
                xb = xb.to(device)
                yb = yb.to(device)
                logits = model(xb)
                loss = criterion(logits, yb)
                val_loss += loss.item() * xb.size(0)
                m += xb.size(0)
        val_loss /= max(1, m)
        scheduler.step(val_loss)

        dt = time.time() - t0
        print(f"epoch {epoch:03d} | train {train_loss:.4f} | val {val_loss:.4f} | {dt:.1f}s")

        if val_loss < best_val:
            best_val = val_loss
            torch.save({
                'model': model.state_dict(),
                'classes': classes,
                'sr': args.sr,
                'n_mels': args.n_mels,
                'duration': args.duration,
                'hop_length': args.hop_length,
            }, best_path)
            print(f"saved: {best_path}")


def _load_ckpt(ckpt_path: str, device: torch.device) -> Tuple[nn.Module, Dict]:
    pkg = torch.load(ckpt_path, map_location=device)
    classes = pkg['classes']
    model = SmallCNN(n_classes=len(classes)).to(device)
    model.load_state_dict(pkg['model'])
    model.eval()
    return model, pkg


def _make_ds(root: str, split: str, pkg: Dict, augment=False) -> AudioDataset:
    return AudioDataset(
        root=root,
        split=split,
        sr=pkg.get('sr', 8000),
        n_mels=pkg.get('n_mels', 64),
        duration=pkg.get('duration', 2.0),
        hop_length=pkg.get('hop_length', 128),
        augment=augment,
        class_names=pkg['classes'],
    )


def evaluate(args):
    device = torch.device('cuda' if torch.cuda.is_available() and not args.cpu else 'cpu')
    model, pkg = _load_ckpt(args.ckpt, device)
    ds = _make_ds(args.data, 'test', pkg, augment=False)
    dl = DataLoader(ds, batch_size=args.batch, shuffle=False, num_workers=2, pin_memory=True)

    y_true, y_pred = [], []
    with torch.no_grad():
        for xb, yb in dl:
            xb = xb.to(device)
            logits = model(xb)
            pred = logits.argmax(1).cpu().numpy().tolist()
            y_pred.extend(pred)
            y_true.extend(yb.numpy().tolist())

    print("Classes:", ds.class_names)
    print(classification_report(y_true, y_pred, target_names=ds.class_names, digits=4))
    cm = confusion_matrix(y_true, y_pred)
    print("Confusion Matrix:\n", cm)


# -----------------------------
# Predict on arbitrary files
# -----------------------------

def _features_for_file(path: str, pkg: Dict) -> torch.Tensor:
    sr = pkg.get('sr', 8000)
    n_mels = pkg.get('n_mels', 64)
    duration = pkg.get('duration', 2.0)
    hop_length = pkg.get('hop_length', 128)
    samples = int(round(sr * duration))

    y, _ = librosa.load(path, sr=sr, mono=True)
    # center crop or pad to fixed duration
    if len(y) < samples:
        y = np.pad(y, (0, samples - len(y)), mode='constant')
    elif len(y) > samples:
        start = (len(y) - samples) // 2
        y = y[start:start + samples]

    S = librosa.feature.melspectrogram(y=y, sr=sr, n_fft=2048, hop_length=hop_length,
                                       n_mels=n_mels, fmin=20, fmax=sr//2, power=2.0, center=True)
    S_db = librosa.power_to_db(S, ref=np.max)
    mu, sigma = np.mean(S_db), np.std(S_db) + 1e-6
    S_db = (S_db - mu) / sigma
    T = torch.tensor(S_db, dtype=torch.float32).unsqueeze(0).unsqueeze(0)  # [1,1,F,T]
    return T


def predict(args):
    device = torch.device('cuda' if torch.cuda.is_available() and not args.cpu else 'cpu')
    model, pkg = _load_ckpt(args.ckpt, device)
    classes = pkg['classes']

    inputs = []
    inpath = Path(args.inpath)
    if inpath.is_dir():
        for fp in list_audio_files(str(inpath)):
            inputs.append(fp)
    else:
        inputs.append(str(inpath))

    results = []
    with torch.no_grad():
        for fp in inputs:
            xb = _features_for_file(fp, pkg).to(device)
            logits = model(xb)
            probs = F.softmax(logits, dim=1).cpu().numpy()[0]
            top = int(np.argmax(probs))
            results.append({
                'file': fp,
                'label': classes[top],
                'probs': {classes[i]: float(probs[i]) for i in range(len(classes))}
            })

    print(json.dumps(results, indent=2, ensure_ascii=False))


# -----------------------------
# Data split helper
# -----------------------------

def prepare_split(args):
    set_seed(args.seed)
    src = Path(args.src)
    dst = Path(args.dst)
    for split in ["train", "val", "test"]:
        ensure_dir(str(dst / split))

    class_dirs = [d for d in src.iterdir() if d.is_dir()]
    for cdir in class_dirs:
        files = list_audio_files(str(cdir))
        random.shuffle(files)
        n = len(files)
        n_train = int(0.8 * n)
        n_val = int(0.1 * n)
        splits = {
            'train': files[:n_train],
            'val': files[n_train:n_train + n_val],
            'test': files[n_train + n_val:]
        }
        for split, flist in splits.items():
            out_cdir = dst / split / cdir.name
            ensure_dir(str(out_cdir))
            for f in flist:
                dst_path = out_cdir / Path(f).name
                if not dst_path.exists():
                    try:
                        # copy file bytes
                        with open(f, 'rb') as fi, open(dst_path, 'wb') as fo:
                            fo.write(fi.read())
                    except Exception as e:
                        print(f"copy fail: {f} -> {dst_path} ({e})")


# -----------------------------
# CLI
# -----------------------------

def build_argparser():
    p = argparse.ArgumentParser(description="Cough/Sniffle/Normal detection")
    sub = p.add_subparsers(dest='cmd', required=True)

    # prepare-split
    sp = sub.add_parser('prepare-split', help='split raw data into train/val/test')
    sp.add_argument('--src', type=str, required=True)
    sp.add_argument('--dst', type=str, required=True)
    sp.add_argument('--seed', type=int, default=1337)

    # train
    sp = sub.add_parser('train', help='train model')
    sp.add_argument('--data', type=str, required=True)
    sp.add_argument('--epochs', type=int, default=40)
    sp.add_argument('--batch', type=int, default=32)
    sp.add_argument('--lr', type=float, default=2e-3)
    sp.add_argument('--sr', type=int, default=8000)
    sp.add_argument('--n-mels', type=int, default=64)
    sp.add_argument('--duration', type=float, default=2.0)
    sp.add_argument('--hop-length', type=int, default=128)
    sp.add_argument('--model-out', type=str, default='models/best.pt')
    sp.add_argument('--cpu', action='store_true')
    sp.add_argument('--seed', type=int, default=1337)

    # eval
    sp = sub.add_parser('eval', help='evaluate on test set')
    sp.add_argument('--data', type=str, required=True)
    sp.add_argument('--ckpt', type=str, required=True)
    sp.add_argument('--batch', type=int, default=64)
    sp.add_argument('--cpu', action='store_true')

    # predict
    sp = sub.add_parser('predict', help='predict for files or a folder')
    sp.add_argument('--ckpt', type=str, required=True)
    sp.add_argument('--inpath', type=str, required=True)
    sp.add_argument('--sr', type=int, default=None, help='ignored; kept for arg parity')
    sp.add_argument('--cpu', action='store_true')

    return p


def main():
    args = build_argparser().parse_args()
    if args.cmd == 'prepare-split':
        prepare_split(args)
    elif args.cmd == 'train':
        train(args)
    elif args.cmd == 'eval':
        evaluate(args)
    elif args.cmd == 'predict':
        predict(args)
    else:
        raise SystemExit("unknown cmd")


if __name__ == '__main__':
    main()


