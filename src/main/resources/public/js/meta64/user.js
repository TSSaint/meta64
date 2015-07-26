console.log("running module: user.js");

var user = function() {

	var _setTitleUsingLoginResponse = function(res) {
		var title = BRANDING_TITLE;
		if (!meta64.isAnonUser) {
			title += " - " + res.userName;
		}
		$("#headerUserName").html(title);

		var loginEnable = meta64.isAnonUser;
		//console.log("loginEnable: "+loginEnable);
		$("#openLoginPgButton").text(loginEnable ? "Login" : "Logout");
	}

	/* TODO: move this into meta64 module */
	var _setStateVarsUsingLoginResponse = function(res) {
		if (res.rootNode) {
			meta64.homeNodeId = res.rootNode.id;
			meta64.homeNodePath = res.rootNode.path;
		}
		meta64.isAdminUser = res.userName === "admin";
		meta64.isAnonUser = res.userName === "anonymous";
		//console.log("***** isAnonUser = "+meta64.isAnonUser);
		meta64.anonUserLandingPageNode = res.anonUserLandingPageNode;
		meta64.editModeOption = res.userPreferences.advancedMode ? meta64.MODE_ADVANCED : meta64.MODE_SIMPLE;
	}

	/* ret is LoginResponse.java */
	var _loginResponse = function(res, info) {
		if (util.checkSuccess("Login", res)) {
			// console.log("info.usr=" + info.usr + " homeNodeOverride: " +
			// res.homeNodeOverride);

			if (info.usr != "anonymous") {
				_.writeCookie(cnst.COOKIE_LOGIN_USR, info.usr);
				_.writeCookie(cnst.COOKIE_LOGIN_PWD, info.pwd);
			}

			meta64.changePage("#mainPage");

			_setStateVarsUsingLoginResponse(res);
			view.refreshTree(!util.emptyString(res.homeNodeOverride) ? res.homeNodeOverride : meta64.homeNodeId, false);
			_setTitleUsingLoginResponse(res);
		} else {
			if (info.usingCookies) {
				alert("Cookie login failed.");

				/*
				 * blow away failed cookie credentials and reload page, should
				 * result in brand new page load as anon user.
				 */
				$.removeCookie(cnst.COOKIE_LOGIN_USR);
				$.removeCookie(cnst.COOKIE_LOGIN_PWD);
				location.reload();
			}
		}
	}

	var _refreshLoginResponse = function(res) {
		// if (res.success) {
		_setStateVarsUsingLoginResponse(res);
		_setTitleUsingLoginResponse(res);
		// }

		meta64.loadAnonPageHome(false);
	}

	var _logoutResponse = function(res) {
		meta64.changePage("#mainPage");
		location.reload();
	}

	var _changePasswordResponse = function(res) {
		if (util.checkSuccess("Change password", res)) {
			alert("Password changed successfully.");
		}
	}

	var _signupResponse = function(res) {
		if (util.checkSuccess("Signup new user", res)) {
			user.populateLoginPgFromCookies();
			meta64.changePage("#loginPg");
			alert("User Information Accepted. \n\nCheck your email for signup confirmation. (Can take up to 1 minute)");
		}
	}

	var _ = {
		/* Write a cookie that expires in a year for all paths */
		writeCookie : function(name, val) {
			$.cookie(name, val, {
				expires : 365,
				path : '/'
			});
		},

		populateLoginPgFromCookies : function() {
			var usr = $.cookie(cnst.COOKIE_LOGIN_USR);
			var pwd = $.cookie(cnst.COOKIE_LOGIN_PWD);
			if (usr) {
				$("#userName").val(usr);
			}
			if (pwd) {
				$("#password").val(pwd);
			}
		},

		/*
		 * This method is ugly. It is the button that can be login *or* logout. 
		 */
		openLoginPg : function() {
			
			var loginEnable = meta64.isAnonUser;
			
			/* Open login dialog */
			if (loginEnable) {
				_.populateLoginPgFromCookies();

				/* make credentials visible only if not logged in */
				util.setVisibility("#loginCredentialFields", meta64.isAnonUser);

				meta64.changePage("#loginPg");
			}
			/* or log out immediately */
			else {
				_.logout();
			}
		},

		signup : function() {
			var userName = util.getRequiredElement("#signupUserName").val();
			var password = util.getRequiredElement("#signupPassword").val();
			var email = util.getRequiredElement("#signupEmail").val();
			var captcha = util.getRequiredElement("#signupCaptcha").val();

			/* no real validation yet, other than non-empty */
			if (util.anyEmpty(userName, password, email, captcha)) {
				alert('Sorry, you cannot leave any fields blank.');
				return;
			}

			util.json("signup", {
				"userName" : userName,
				"password" : password,
				"email" : email,
				"captcha" : captcha
			}, _signupResponse);
		},

		pageInitSignupPg : function() {
			user.tryAnotherCaptcha();
		},

		tryAnotherCaptcha : function() {

			var n = util.currentTimeMillis();

			/*
			 * embed a time parameter just to thwart browser caching, and ensure
			 * server and browser will never return the same image twice.
			 */
			var src = "/mobile/rest/captcha?t=" + n
			// console.log("Setting captcha image src: "+src);

			/*
			 * we use a semi-guaranteed unique (timecodebased) integer to force
			 * a new captcha to be returned
			 */
			$("#captchaImage").attr("src", src);
		},

		refreshLogin : function() {

			var usr = $.cookie(cnst.COOKIE_LOGIN_USR);
			var pwd = $.cookie(cnst.COOKIE_LOGIN_PWD);

			var usingCookies = !util.emptyString(usr) && !util.emptyString(pwd);
			// console.log("cookieUser=" + usr + " usingCookies = " +
			// usingCookies);
			/*
			 * Session is a special indicator that tells server to just attempt
			 * the login from the session varibles. perhaps I should have added
			 * a REST attribute for this. It's sort of a an anti-pattern. (TODO:
			 * fix)
			 */
			var callUsr = usr ? usr : "{session}";
			var callPwd = pwd ? pwd : "{session}";

			// console.log("refreshLogin with name: " + callUsr);

			//var hrs = -(new Date().getTimezoneOffset() / 60);
			//alert("TimeZoneOffset: "+hrs);
			
			util.json("login", {
				"userName" : callUsr,
				"password" : callPwd,
				"usingCookies" : usingCookies,
				"tzOffset" : new Date().getTimezoneOffset(),
				"dst" : util.daylightSavingsTime
			}, usingCookies ? _loginResponse : _refreshLoginResponse, {
				usr : callUsr,
				pwd : callPwd,
				"usingCookies" : usingCookies
			});
		},
		
		login : function() {

			var usr = $.trim($("#userName").val());
			var pwd = $.trim($("#password").val());

			/*
			 * the json is in here twice because we happen to need to feed the
			 * same INFO to the _loginResponse method. I'll just cod it this way
			 * instead of creating a var to hold it.
			 */
			util.json("login", {
				"userName" : usr,
				"password" : pwd,
				"tzOffset" : new Date().getTimezoneOffset(),
				"dst" : util.daylightSavingsTime
			}, _loginResponse, {
				"usr" : usr,
				"pwd" : pwd
			});
		},

		logout : function() {

			/*
			 * our choice of behavior here is that when logging out we clean out
			 * cookies, so the logout is permanent. User can stay logged in
			 * simply by never logging out, but the logout securely disables the
			 * client computer from being able to just automatically log in
			 * again, which seems like the behavior I'd like.
			 */
			$.removeCookie(cnst.COOKIE_LOGIN_USR);
			$.removeCookie(cnst.COOKIE_LOGIN_PWD);

			util.json("logout", {}, _logoutResponse);
		},

		changePassword : function() {
			var pwd1 = util.getRequiredElement("#changePassword1").val();
			var pwd2 = util.getRequiredElement("#changePassword2").val();
			if (pwd1 && pwd1.length >= 4 && pwd1 === pwd2) {
				util.json("changePassword", {
					"newPassword" : pwd1
				}, _changePasswordResponse);
			} else {
				alert('Sorry, invalid password(s).');
			}
		},

		changePasswordPg : function() {
			meta64.changePage("#changePasswordPg");
		}
	};

	console.log("Module ready: user.js");
	return _;
}();

// # sourceURL=user.js
