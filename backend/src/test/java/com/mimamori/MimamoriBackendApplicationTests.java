package com.mimamori;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import static org.junit.jupiter.api.Assertions.assertTrue;

class MimamoriBackendApplicationTests {

	@Test
	void applicationBootstrapIsPresent() {
		assertTrue(MimamoriBackendApplication.class.isAnnotationPresent(SpringBootApplication.class));
	}

}
