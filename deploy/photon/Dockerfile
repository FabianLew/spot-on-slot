# Self-hosted Photon geocoder for production (LOCATION_GEOCODER_URL). The public photon.komoot.io is for development only.
# The database is not part of the image: start.sh imports the JSON dump from PHOTON_DUMP_URL into the /photon/data volume on first start.
FROM eclipse-temurin:21-jre-jammy

ARG PHOTON_VERSION=1.0.0

RUN apt-get update \
 && apt-get install -y --no-install-recommends zstd \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 photon \
 && useradd --system --uid 1001 --gid 1001 --home /photon --shell /usr/sbin/nologin photon \
 && mkdir -p /photon/data \
 && wget -q -O /photon/photon.jar "https://github.com/komoot/photon/releases/download/${PHOTON_VERSION}/photon-${PHOTON_VERSION}.jar" \
 && chown -R photon:photon /photon

COPY --chmod=755 start.sh /photon/start.sh

ENV JAVA_OPTS="-Xmx2g"
USER photon
WORKDIR /photon
VOLUME /photon/data
EXPOSE 2322

# The first start downloads and imports the dump, which takes a while.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60m --retries=3 \
  CMD wget --quiet --tries=1 --spider "http://127.0.0.1:2322/api?q=Krakow&limit=1" || exit 1

ENTRYPOINT ["/photon/start.sh"]
