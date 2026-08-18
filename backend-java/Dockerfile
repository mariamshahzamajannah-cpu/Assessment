FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY . .
RUN echo "=== SOURCE FILES ===" && find src -name "*.java" && echo "=== END SOURCE FILES ==="
RUN mvn clean package -DskipTests -q
RUN echo "=== JAR CLASSES ===" && jar tf target/*.jar | grep "BOOT-INF/classes/com/claimsring" && echo "=== END JAR CLASSES ==="

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
