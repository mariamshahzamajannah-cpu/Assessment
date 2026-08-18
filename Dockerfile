FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY . .
RUN find . -path ./target -prune -o -name "*.java" -print > /tmp/javafiles.txt && cat /tmp/javafiles.txt
RUN mvn clean package -DskipTests -q
RUN unzip -l target/*.jar | grep -i "BOOT-INF/classes/com" | head -20

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
