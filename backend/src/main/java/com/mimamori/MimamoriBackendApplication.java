package com.mimamori;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class MimamoriBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(MimamoriBackendApplication.class, args);
	}

}
