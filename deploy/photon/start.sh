#!/bin/sh
set -eu

DATA_DIR=/photon/data

if [ ! -d "$DATA_DIR/photon_data" ]; then
  : "${PHOTON_DUMP_URL:?Set PHOTON_DUMP_URL to a Photon JSON dump (.jsonl.zst) matching the Photon version (see docs/deployment.md)}"
  echo "Importing the Photon database from $PHOTON_DUMP_URL"
  # Import next to the target and rename at the end, so an interrupted import never looks like a database.
  rm -rf "$DATA_DIR/unpacking"
  mkdir -p "$DATA_DIR/unpacking"
  wget -q -O - "$PHOTON_DUMP_URL" | zstd -d --stdout | java $JAVA_OPTS -jar /photon/photon.jar import -import-file - -data-dir "$DATA_DIR/unpacking"
  mv "$DATA_DIR/unpacking/photon_data" "$DATA_DIR/photon_data"
  rm -rf "$DATA_DIR/unpacking"
fi

exec java $JAVA_OPTS -jar /photon/photon.jar serve -data-dir "$DATA_DIR" -listen-ip 0.0.0.0 -listen-port 2322
