# syntax=docker/dockerfile:1

# Stage 1: Build the application
FROM eclipse-temurin:25-jdk-jammy AS build

WORKDIR /app

# Install Maven
RUN apt-get update && apt-get install -y maven

# Copy the pom.xml and resolve dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -DskipTests

# Copy source code and build the package
COPY src ./src
RUN mvn package -DskipTests && \
    mv target/*-SNAPSHOT.jar target/app.jar

# Stage 2: Create the minimal runtime image
FROM eclipse-temurin:25-jre-jammy AS final

# Create a non-root user
ARG UID=10001
RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/nonexistent" \
    --shell "/sbin/nologin" \
    --no-create-home \
    --uid "${UID}" \
    appuser

USER appuser
WORKDIR /app

# Copy the built jar from the build stage
COPY --from=build /app/target/app.jar .

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
