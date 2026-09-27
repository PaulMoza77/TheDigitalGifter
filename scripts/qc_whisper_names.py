#!/usr/bin/env python3
import json
import os
import subprocess
import urllib.request
from pathlib import Path

base = Path("/tmp/talking-santa-batch-names")
key = os.environ["OPENAI_API_KEY"].strip()
results = {}
for n in ["emma", "olivia", "sophia", "liam", "noah"]:
    mp4 = base / f"talking_santa_{n}_final.mp4"
    wav = base / f"qc_audio_{n}.wav"
    subprocess.check_call(
        ["ffmpeg", "-y", "-i", str(mp4), "-vn", "-ac", "1", "-ar", "16000", str(wav)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    boundary = b"----tdgqcboundary"
    body = b"".join(
        [
            b"--" + boundary + b"\r\n",
            b'Content-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n',
            b"--" + boundary + b"\r\n",
            b'Content-Disposition: form-data; name="file"; filename="a.wav"\r\n',
            b"Content-Type: audio/wav\r\n\r\n",
            wav.read_bytes(),
            b"\r\n--" + boundary + b"--\r\n",
        ]
    )
    req = urllib.request.Request(
        "https://api.openai.com/v1/audio/transcriptions",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": f"multipart/form-data; boundary={boundary.decode()}",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        text = json.loads(resp.read().decode()).get("text", "")
    results[n] = text.strip()
print(json.dumps(results, indent=2))
