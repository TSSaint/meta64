package com.meta64.mobile.util;

/**
 * General validations.
 */
public class Validator {

	/*
	 * UserName requirements, between 5 and 100 characters (inclusive) long, and only allowing
	 * digits, letters, underscore, dash, and space.
	 * 
	 * Note that part of our requirement is that it must also be a valid substring inside JCR path
	 * names, that are used or looking up things about this user.
	 */
	public static void checkUserName(String text) throws Exception {
		int len = text.length();
		if (len < 5 || len > 100) throw new Exception("Username must be between 5 and 100 characters long.");

		for (int i = 0; i < len; i++) {
			char c = text.charAt(i);
			if (!(Character.isLetterOrDigit(c) || c == '-' || c == '_' || c == ' ')) {
				throw new Exception("Username can contain only letters, digits, dashes, underscores, and spaces.");
			}
		}
	}

	/* passwords are only checked for length of 5 thru 100 */
	public static void checkPassword(String text) throws Exception {
		int len = text.length();
		if (len < 5 || len > 40) throw new Exception("Password must be between 5 and 40 characters long.");
	}

	public static void checkEmail(String text) throws Exception {
		int len = text.length();
		if (len < 7 || len > 100) throw new Exception("Invalid email address");
	}
}
