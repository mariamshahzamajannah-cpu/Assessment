FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY . .
RUN find src -name "*.java" | head -50
RUN mvn clean package -DskipTests
RUN jar tf target/*.jar | grep -i FraudRing

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
