"""Shared access to the Jolpica CSV database dump.

The free `delayed` tier trails the latest dump by 14 days; the historical
tables it carries are static, so backfills read it directly.
"""

import hashlib
import io
import os
import zipfile

import pandas as pd
import requests

DUMP_INDEX_URL = "https://api.jolpi.ca/data/dumps/download/"
DUMP_TIER = "delayed"


def default_dump_path():
    """Path of the shared dump inside the gitignored cache directory."""
    path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../cache/jolpica_dump.zip")
    )
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return path


def fetch_dump_metadata():
    """Return the published CSV dump metadata for the delayed tier."""
    index = requests.get(DUMP_INDEX_URL, timeout=60)
    index.raise_for_status()
    return index.json()[f"{DUMP_TIER}_dumps"]["csv"]


def download_dump(dest_path):
    """Download the delayed CSV dump and verify its published SHA256."""
    meta = fetch_dump_metadata()

    size_mb = meta["file_size"] / 1e6
    print(f"  ⬇️  Downloading dump ({size_mb:.1f} MB, uploaded {meta['uploaded_at']})")
    resp = requests.get(meta["download_url"], timeout=600)
    resp.raise_for_status()

    digest = hashlib.sha256(resp.content).hexdigest()
    if digest != meta["file_hash"]:
        raise RuntimeError(
            f"Dump hash mismatch: expected {meta['file_hash']}, got {digest}"
        )

    with open(dest_path, "wb") as f:
        f.write(resp.content)
    print(f"  ✓ Verified and saved to {dest_path}")
    return meta


def file_digest(path):
    """SHA256 of a dump already on disk."""
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_table(archive, name):
    """Read one CSV table out of the dump archive."""
    with archive.open(f"formula_one_{name}.csv") as f:
        return pd.read_csv(io.BytesIO(f.read()))


def read_tables(dump_path, names):
    """Read several dump tables in one pass, keyed by table name."""
    with zipfile.ZipFile(dump_path) as archive:
        return {name: read_table(archive, name) for name in names}
