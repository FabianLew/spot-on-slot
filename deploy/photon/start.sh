#!/bin/sh
set -eu

DATA_DIR=/photon/data

if [ ! -d "$DATA_DIR/photon_data" ]; then
  : "${PHOTON_DUMP_URL:?Set PHOTON_DUMP_URL to a Photon database dump matching the Photon version (see docs/deployment.md)}"
  echo "Downloading the Photon database from $PHOTON_DUMP_URL"
  # Unpack next to the target and rename at the end, so an interrupted download never looks like a database.
  rm -rf "$DATA_DIR/unpacking"
  mkdir -p "$DATA_DIR/unpacking"
  wget -q -O - "$PHOTON_DUMP_URL" | pbzip2 -cd | tar x -C "$DATA_DIR/unpacking"
  mv "$DATA_DIR/unpacking/photon_data" "$DATA_DIR/photon_data"
  rm -rf "$DATA_DIR/unpacking"
fi

exec java $JAVA_OPTS -jar /photon/photon.jar serve -data-dir "$DATA_DIR" -listen-ip 0.0.0.0 -listen-port 2322
