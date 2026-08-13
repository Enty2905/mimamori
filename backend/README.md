# Mimamori backend

Spring Boot 4.1 / Java 21 API boundary for mobile, business services and the
server-side Care Agent.

```text
./mvnw test
./mvnw spring-boot:run
```

Only the generated application bootstrap and module skeletons exist at this
stage. API and business logic have not been implemented.

Quartz is configured for a JDBC job store but remains stopped in this empty
base. Enable it only after its tables are introduced through a Flyway migration.
