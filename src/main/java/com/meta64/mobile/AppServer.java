package com.meta64.mobile;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Standard SpringBoot entry point. Starts up entire application, which will run an instance of
 * Tomcat embedded and open the port specified in the properties file and start serving up requests.
 */
@SpringBootApplication
@EnableScheduling
public class AppServer {

	public static void main(String[] args) {
		SpringApplication.run(AppServer.class, args);
	}
}
