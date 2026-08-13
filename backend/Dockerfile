FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace

COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B dependency:go-offline

COPY src/ src/
RUN ./mvnw -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 10001 mimamori
COPY --from=build /workspace/target/*.jar app.jar
USER mimamori
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
