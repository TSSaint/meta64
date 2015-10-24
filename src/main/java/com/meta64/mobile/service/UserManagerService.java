package com.meta64.mobile.service;

import java.util.List;

import javax.jcr.Node;
import javax.jcr.Session;

import org.apache.commons.lang3.StringUtils;
import org.apache.jackrabbit.JcrConstants;
import org.apache.jackrabbit.oak.spi.security.principal.EveryonePrincipal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;
import org.springframework.ui.Model;

import com.meta64.mobile.config.ConstantsProvider;
import com.meta64.mobile.config.JcrName;
import com.meta64.mobile.config.JcrPrincipal;
import com.meta64.mobile.config.JcrProp;
import com.meta64.mobile.config.JcrPropVal;
import com.meta64.mobile.config.SessionContext;
import com.meta64.mobile.mail.JcrOutboxMgr;
import com.meta64.mobile.model.RefInfo;
import com.meta64.mobile.model.UserPreferences;
import com.meta64.mobile.request.ChangePasswordRequest;
import com.meta64.mobile.request.CloseAccountRequest;
import com.meta64.mobile.request.LoginRequest;
import com.meta64.mobile.request.SaveUserPreferencesRequest;
import com.meta64.mobile.request.SignupRequest;
import com.meta64.mobile.response.ChangePasswordResponse;
import com.meta64.mobile.response.CloseAccountResponse;
import com.meta64.mobile.response.LoginResponse;
import com.meta64.mobile.response.SaveUserPreferencesResponse;
import com.meta64.mobile.response.SignupResponse;
import com.meta64.mobile.user.AccessControlUtil;
import com.meta64.mobile.user.RunAsJcrAdmin;
import com.meta64.mobile.user.UserManagerUtil;
import com.meta64.mobile.util.DateUtil;
import com.meta64.mobile.util.Encryptor;
import com.meta64.mobile.util.JcrUtil;
import com.meta64.mobile.util.ValContainer;
import com.meta64.mobile.util.Validator;

/**
 * Service methods for processing user management functions. Login, logout, signup, user
 * preferences, and settings persisted per-user
 * 
 */
@Component
@Scope("singleton")
public class UserManagerService {
	private static final Logger log = LoggerFactory.getLogger(UserManagerService.class);

	@Value("${anonUserLandingPageNode}")
	private String anonUserLandingPageNode;

	/*
	 * We only use mailHost in this class to detect if email is configured and if not we fail all
	 * signups. Currently this system does require email to be in the process for signing up users.
	 */
	@Value("${mail.host}")
	public String mailHost;

	@Autowired
	private SessionContext sessionContext;

	@Autowired
	private JcrOutboxMgr outboxMgr;

	@Autowired
	private RunAsJcrAdmin adminRunner;

	@Autowired
	private NodeSearchService nodeSearchService;

	@Autowired
	private ConstantsProvider constProvider;

	@Autowired
	private Encryptor encryptor;

	/*
	 * Login mechanism is a bit tricky because the OakSession ASPECT (AOP) actually detects the
	 * LoginRequest and performs authentication BEFORE this 'login' method even gets called, so by
	 * the time we are in this method we can safely assume the userName and password resulted in a
	 * successful login. If login fails the getJcrSession() call below will return null also.
	 * 
	 * IMPORTANT: this method DOES get called even on a fresh page load when the user hasn't logged
	 * in yet, and this is done passing "" (blank) in place of userName/password, which tells this
	 * login method to get a username/password from the session. So a valid session that's already
	 * logged in will simply return the correct login information from here as if it were logging in
	 * the first time. For an SPA (Single Page App), handling page reloads needs to do something
	 * like this because we aren't just having session beans embedded on some JSP the old-school
	 * way, this is different and this is better! This is the proper way for an SPA to handle page
	 * reloads.
	 */
	public void login(Session session, LoginRequest req, LoginResponse res) throws Exception {

		String userName = req.getUserName();
		String password = req.getPassword();
		log.trace("login: user=" + userName);

		/*
		 * We have to get timezone information from the user's browser, so that all times on all
		 * nodes always show up in their precise local time!
		 */
		sessionContext.setTimezone(DateUtil.getTimezoneFromOffset(req.getTzOffset()));
		sessionContext.setTimeZoneAbbrev(DateUtil.getUSTimezone(-req.getTzOffset() / 60, req.isDst()));

		if (userName.equals("")) {
			userName = sessionContext.getUserName();
		}
		else {
			sessionContext.setUserName(userName);
			sessionContext.setPassword(password);
		}

		if (session == null) {
			log.trace("    session==null, using anonymous user");
			/*
			 * Note: This is not an error condition, this happens whenever the page loads for the
			 * first time and the user has no session yet,
			 */
			res.setUserName("anonymous");
			res.setMessage("not logged in.");
			res.setSuccess(false);
		}
		else {
			RefInfo rootRefInfo = UserManagerUtil.getRootNodeRefInfoForUser(session, userName);
			sessionContext.setRootRefInfo(rootRefInfo);
			res.setRootNode(rootRefInfo);
			res.setUserName(userName);

			try {
				UserPreferences userPreferences = getUserPreferences(session);
				sessionContext.setUserPreferences(userPreferences);
				res.setUserPreferences(userPreferences);
			}
			catch (Exception e) {
				/*
				 * If something goes wrong loading preferences just log and continue. Should never
				 * happen but we might as well be resilient here.
				 */
				// log.error("Failed loading preferences: ", e);
			}
			res.setSuccess(true);
		}
		res.setAnonUserLandingPageNode(anonUserLandingPageNode);

		log.debug("Processing Login: urlId=" + (sessionContext.getUrlId() != null ? sessionContext.getUrlId() : "null"));

		res.setHomeNodeOverride(sessionContext.getUrlId());

		if (res.getUserPreferences() == null) {
			res.setUserPreferences(getDefaultUserPreferences());
		}
	}

	public void closeAccount(Session session__unused, CloseAccountRequest req, CloseAccountResponse res) throws Exception {
		log.debug("Closing Account: " + sessionContext.getUserName());
		adminRunner.run((Session session) -> {
			String userName = sessionContext.getUserName();

			/* Remove user from JCR user manager */
			UserManagerUtil.removeUser(session, userName);

			/*
			 * And remove the two nodes on the tree that we have for this user (root and
			 * preferences)
			 */
			Node allUsersRoot = JcrUtil.getNodeByPath(session, "/" + JcrName.ROOT + "/" + userName);
			if (allUsersRoot != null) {
				allUsersRoot.remove();
			}
			Node prefsNode = getPrefsNodeForSessionUser(session, userName);
			if (prefsNode != null) {
				prefsNode.remove();
			}
			session.save();
		});
	}

	/*
	 * Processes last set of signup, which is validation of registration code. This means user has
	 * clicked the link they were sent during the signup email verification, and they are sending in
	 * a signupCode that will turn on their account and actually create their account.
	 */
	public void processSignupCode(final String signupCode, final Model model) throws Exception {
		log.debug("User is trying signupCode: " + signupCode);
		adminRunner.run((Session session) -> {
			try {
				Node node = nodeSearchService.findNodeByProperty(session, "/" + JcrName.SIGNUP, //
						JcrProp.CODE, signupCode);

				if (node != null) {
					String userName = JcrUtil.getRequiredStringProp(node, JcrProp.USER);
					String password = JcrUtil.getRequiredStringProp(node, JcrProp.PWD);
					password = encryptor.decrypt(password);
					String email = JcrUtil.getRequiredStringProp(node, JcrProp.EMAIL);

					initNewUser(session, userName, password, email, JcrPropVal.META64);

					/*
					 * allow JavaScript to detect all it needs to detect which is to display a
					 * message to user saying the signup is complete.
					 */
					model.addAttribute("signupCode", "ok");
					node.remove();
					session.save();
				}
				else {
					throw new Exception("Signup Code is invalid.");
				}
			}
			catch (Exception e) {
				// need to message back to user signup failed.
			}
		});
	}

	/*
	 * Email will not be null unless it's a Social Media oAuth signup.
	 * 
	 * oauthService == 'twitter' or 'meta64'
	 */
	public void initNewUser(Session session, String userName, String password, String email, String oauthService) throws Exception {
		if (UserManagerUtil.createUser(session, userName, password)) {
			UserManagerUtil.createUserRootNode(session, userName);

			Node prefsNode = getPrefsNodeForSessionUser(session, userName);
			if (email != null) {
				prefsNode.setProperty(JcrProp.EMAIL, email);
			}

			prefsNode.setProperty(JcrProp.AUTH_SERVICE, oauthService);
			prefsNode.setProperty(JcrProp.PWD, encryptor.encrypt(password));

			setDefaultUserPreferences(prefsNode);
			session.save();
			log.debug("Successful signup complete.");
		}
	}

	public List<String> getOwnerNames(final Node node) throws Exception {
		final ValContainer<List<String>> ret = new ValContainer<List<String>>();
		adminRunner.run((Session session) -> {
			ret.setVal(AccessControlUtil.getOwnerNames(session, node));
		});
		return ret.getVal();
	}

	/* Returns true if the user exists and matches the oauthServie */
	public boolean userExists(Session session, String userName, String oauthService, ValContainer<String> passwordContainer) throws Exception {
		Node prefsNode = JcrUtil.getNodeByPath(session, "/" + JcrName.USER_PREFERENCES + "/" + userName);
		if (prefsNode != null) {
			String serviceProperty = JcrUtil.safeGetStringProp(prefsNode, JcrProp.AUTH_SERVICE);
			if (oauthService.equals(serviceProperty)) {
				if (passwordContainer != null) {
					String password = JcrUtil.safeGetStringProp(prefsNode, JcrProp.PWD);
					password = encryptor.decrypt(password);
					passwordContainer.setVal(password);
				}
				return true;
			}
		}
		return false;
	}

	/*
	 * Processes a signup request from a user. The user doesn't immediately get an account, but an
	 * email goes out to them that when they click on the link in the email the signupCode comes
	 * back and actually creates their account at that time.
	 */
	public void signup(SignupRequest req, SignupResponse res) throws Exception {

		final String userName = req.getUserName();
		if (userName.equalsIgnoreCase(JcrPrincipal.ADMIN) || userName.equalsIgnoreCase("administrator")) {
			throw new Exception("Sorry, you can't be the new admin.");
		}

		if (userName.equalsIgnoreCase(EveryonePrincipal.NAME)) {
			throw new Exception("Sorry, you can't be everyone.");
		}

		final String password = req.getPassword();
		final String email = req.getEmail();
		final String captcha = req.getCaptcha() == null ? "" : req.getCaptcha();

		log.debug("Signup: userName=" + userName + " email=" + email + " captcha=" + captcha);

		/* throw exceptions of the username or password are not valid */
		Validator.checkUserName(userName);
		Validator.checkPassword(password);
		Validator.checkEmail(email);

		/*
		 * test cases will simply pass null, for captcha, and we let that pass
		 */
		if (captcha != null && !captcha.equals(sessionContext.getCaptcha())) {
			log.debug("Captcha match!");
			throw new Exception("Wrong captcha text.");
		}

		initiateSignup(userName, password, email);

		res.setMessage("success: " + String.valueOf(++sessionContext.counter));
		res.setSuccess(true);
	}

	/*
	 * Adds user to the JCR list of pending accounts and they will stay in pending status until
	 * their signupCode has been used to validate their email address
	 */
	public void initiateSignup(String userName, String password, String email) throws Exception {

		String signupCode = JcrUtil.getGUID();
		String signupLink = constProvider.getHostAndPort() + "?signupCode=" + signupCode;
		String content = "Confirmation for new meta64 account: " + userName + //
				"<p>\nGo to this page to complete signup: <br>\n" + signupLink;

		addPendingSignupNode(userName, password, email, signupCode);

		if (!StringUtils.isEmpty(mailHost)) {
			outboxMgr.queueEmail(email, "Meta64 Account Signup Confirmation", content);
		}
	}

	/*
	 * Creates the node on the tree that holds the user info pending email validation.
	 */
	public void addPendingSignupNode(final String userName, final String password, final String email, final String signupCode) throws Exception {

		adminRunner.run((Session session) -> {

			try {
				Node checkNode = session.getNode("/" + JcrName.SIGNUP + "/" + userName);
				throw new Exception("User name is already pending signup.");
			}
			catch (Exception e) {
				// normal flow. Not an error here.
			}

			Node signupNode = session.getNode("/" + JcrName.SIGNUP);
			if (signupNode == null) {
				throw new Exception("Signup node not found.");
			}

			Node newNode = signupNode.addNode(userName, JcrConstants.NT_UNSTRUCTURED);
			newNode.setProperty(JcrProp.USER, userName);
			newNode.setProperty(JcrProp.PWD, encryptor.encrypt(password));
			newNode.setProperty(JcrProp.EMAIL, email);
			newNode.setProperty(JcrProp.CODE, signupCode);
			JcrUtil.timestampNewNode(session, newNode);
			session.save();
		});
	}

	/*
	 * Get node that contains all preferences for this user, as properties on it.
	 */
	public static Node getPrefsNodeForSessionUser(Session session, String userName) throws Exception {
		return JcrUtil.ensureNodeExists(session, "/" + JcrName.USER_PREFERENCES + "/", userName, //
				"User: " + userName);
	}

	public void setDefaultUserPreferences(Node prefsNode) throws Exception {
		prefsNode.setProperty(JcrProp.USER_PREF_ADV_MODE, false);
	}

	public void saveUserPreferences(Session session_unused, final SaveUserPreferencesRequest req, final SaveUserPreferencesResponse res) throws Exception {

		final String userName = sessionContext.getUserName();

		adminRunner.run((Session session) -> {
			Node prefsNode = getPrefsNodeForSessionUser(session, userName);

			/*
			 * Assign preferences as properties on this node,
			 */
			boolean isAdvancedMode = req.getUserPreferences().isAdvancedMode();
			prefsNode.setProperty(JcrProp.USER_PREF_ADV_MODE, isAdvancedMode);
			session.save();

			/*
			 * Also update session-scope object, because server-side functions that need preference
			 * information will get it from there instead of loading it from repository. The only
			 * time we load user preferences from repository is during login when we can't get it
			 * form anywhere else at that time.
			 */
			UserPreferences userPreferences = sessionContext.getUserPreferences();
			userPreferences.setAdvancedMode(isAdvancedMode);

			res.setSuccess(true);
		});
	}

	public UserPreferences getDefaultUserPreferences() {
		return new UserPreferences();
	}

	public UserPreferences getUserPreferences(Session session__unused) throws Exception {
		final String userName = sessionContext.getUserName();
		final UserPreferences userPrefs = new UserPreferences();

		adminRunner.run((Session session) -> {
			Node prefsNode = getPrefsNodeForSessionUser(session, userName);

			userPrefs.setAdvancedMode(JcrUtil.safeGetBooleanProp(prefsNode, JcrProp.USER_PREF_ADV_MODE));
			userPrefs.setLastNode(JcrUtil.safeGetStringProp(prefsNode, JcrProp.USER_PREF_LAST_NODE));

			// String password = JcrUtil.safeGetStringProp(prefsNode,
			// JcrProp.PWD);
			// log.debug("password: "+encryptor.decrypt(password));
		});

		return userPrefs;
	}

	/*
	 * Each user has a node on the tree that holds all their user preferences. This method retrieves
	 * that node for the user logged into the current HTTP Session (Session Scope Bean)
	 */
	public Node getUserPrefsNode(Session session) throws Exception {

		String userName = sessionContext.getUserName();
		Node allUsersRoot = JcrUtil.getNodeByPath(session, "/" + JcrName.ROOT);
		if (allUsersRoot == null) {
			throw new Exception("/root not found!");
		}

		log.debug("Creating root node, which didn't exist.");

		Node newNode = allUsersRoot.addNode(userName, JcrConstants.NT_UNSTRUCTURED);
		JcrUtil.timestampNewNode(session, newNode);
		if (newNode == null) {
			throw new Exception("unable to create root");
		}

		if (AccessControlUtil.grantFullAccess(session, newNode, userName)) {
			newNode.setProperty(JcrProp.CONTENT, "Root for User: " + userName);
			session.save();
		}

		return allUsersRoot;
	}

	/*
	 * Runs when user is doing the 'change password'.
	 */
	public void changePassword(Session session__unused, final ChangePasswordRequest req, ChangePasswordResponse res) throws Exception {
		final String userName = sessionContext.getUserName();

		adminRunner.run((Session session) -> {
			String password = req.getNewPassword();
			UserManagerUtil.changePassword(session, userName, password);

			Node prefsNode = getPrefsNodeForSessionUser(session, userName);
			prefsNode.setProperty(JcrProp.PWD, encryptor.encrypt(password));

			session.save();
		});

		sessionContext.setPassword(req.getNewPassword());
		res.setSuccess(true);
	}

	/*
	 * Warning: not yet tested. Ended up not needing this yet.
	 */
	public String getPasswordOfUser(final String userName) throws Exception {
		final ValContainer<String> password = new ValContainer<String>();
		adminRunner.run((Session session) -> {
			Node prefsNode = getPrefsNodeForSessionUser(session, userName);
			String encPwd = JcrUtil.getRequiredStringProp(prefsNode, JcrProp.PWD);
			password.setVal(encryptor.decrypt(encPwd));
		});
		return password.getVal();
	}
}
