# syntax=docker/dockerfile:1
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src src
RUN mvn -q -B -DskipTests package && cp target/*.jar /app.jar

# Extract the jar and record a class-data-sharing archive: cuts cold-start time a lot on small (free-tier) CPUs.
# The archive records class-path locations, so train at the same path (/app) the final image runs from.
FROM eclipse-temurin:21-jre-alpine AS cds
COPY --from=build /app.jar /tmp/app.jar
RUN java -Djarmode=tools -jar /tmp/app.jar extract --destination /app \
 && cd /app && java -XX:ArchiveClassesAtExit=app.jsa -Dspring.context.exit=onRefresh -Dspring.profiles.active=dev \
      -Dspring.flyway.enabled=false -Dspring.jpa.hibernate.ddl-auto=none -Dgatemate.integrations.public-data-enabled=false -jar app.jar

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=cds /app /app
USER app
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError -XX:TieredStopAtLevel=1 -XX:SharedArchiveFile=/app/app.jsa -Xshare:auto"
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:${PORT:-8080}/actuator/health || exit 1
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
