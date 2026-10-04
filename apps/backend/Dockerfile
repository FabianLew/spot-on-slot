# syntax=docker/dockerfile:1.7

# ---------- Build stage ----------
FROM eclipse-temurin:21-jdk-jammy AS build

WORKDIR /workspace

COPY gradlew gradlew.bat ./
COPY gradle ./gradle
COPY settings.gradle build.gradle gradle.properties ./

RUN chmod +x ./gradlew && ./gradlew --no-daemon dependencies > /dev/null 2>&1 || true

COPY src ./src

RUN ./gradlew --no-daemon clean bootJar -x test

# ---------- Runtime stage ----------
FROM eclipse-temurin:21-jre-jammy AS runtime

RUN groupadd --system --gid 1001 appuser \
 && useradd --system --uid 1001 --gid 1001 --home /app --shell /usr/sbin/nologin appuser

WORKDIR /app

COPY --from=build /workspace/build/libs/*.jar /app/app.jar

ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Dfile.encoding=UTF-8"

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
