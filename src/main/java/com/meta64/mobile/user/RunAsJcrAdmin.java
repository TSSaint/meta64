package com.meta64.mobile.user;

import javax.jcr.Session;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.meta64.mobile.repo.OakRepository;
import com.meta64.mobile.util.JcrRunnable;

/**
 * Helper class to run some processing workload as the admin user. Simplifies by encapsulating the
 * session management at this abstracted layer. Run primarily as a Java-8 Lambda, and working very
 * similar to what is also known as an AOP aspect, although not using an 'aspect' but mainly just a
 * Lambda (i.e. 'Functional Interface')
 */
@Component
public class RunAsJcrAdmin {
	private static final Logger log = LoggerFactory.getLogger(RunAsJcrAdmin.class);

	@Autowired
	private OakRepository oak;

	public void run(JcrRunnable runner) {
		Session session = null;

		try {
			session = oak.newAdminSession();
			runner.run(session);
		}
		// catch (Exception ex) {
		// log.error("error", ex);
		// throw ex;
		// }
		finally {
			if (session != null) {
				session.logout();
			}
		}
	}
}
