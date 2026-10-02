package com.example.archive_be;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(scanBasePackages = "com.example")
@EntityScan(basePackages = "com.example.archivebe.archive")
@EnableJpaRepositories(basePackages = "com.example.archivebe.archive")
public class ArchiveBeApplication {

	public static void main(String[] args) {
		SpringApplication.run(ArchiveBeApplication.class, args);
	}

}
