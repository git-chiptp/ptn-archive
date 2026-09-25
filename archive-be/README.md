# archive-be

Spring Boot backend for the transcript archive. PostgreSQL schema changes are managed by Flyway in `src/main/resources/db/migration`.

## Local database

```sql
CREATE USER archive_user WITH PASSWORD 'change-this-password';
CREATE DATABASE archive_db OWNER archive_user;
```

Start the application with `mvn spring-boot:run` and check `GET /actuator/health` or `GET /api/archives`.

The seeded rows in `V2__seed_archives.sql` are intended for local development. Do not use the sample password in a deployed environment.
