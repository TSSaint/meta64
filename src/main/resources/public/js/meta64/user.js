console.log("running module: user.js");

var user = function() {

	var _setTitleUsingLoginResponse = function(res) {
		var title = BRANDING_TITLE;
		if (!meta64.isAnonUser) {
			title += " - " + res.userName;
		}
		$("#headerUserName").html(title);

		var loginEnable = meta64.isAnonUser;
		// console.log("loginEnable: "+loginEnable);
		$("#openLoginPgButton").text(loginEnable ? "Login" : "Logout");
	}

	/* TODO: move this into meta64 module */
	var _setStateVarsUsingLoginResponse = function(res) {
		if (res.rootNode) {
			meta64.homeNodeId = res.rootNode.id;
			meta64.homeNodePath = res.rootNode.path;
		}
		meta64.userName = res.userName;
		meta64.isAdminUser = res.userName === "admin";
		meta64.isAnonUser = res.userName === "anonymous";
		// console.log("***** isAnonUser = "+meta64.isAnonUser);
		meta64.anonUserLandingPageNode = res.anonUserLandingPageNode;
		meta64.editModeOption = res.userPreferences.advancedMode ? meta64.MODE_ADVANCED : meta64.MODE_SIMPLE;
	}

	/* ret is LoginResponse.java */
	var _loginResponse = function(res, usr, pwd, usingCookies) {
		if (util.checkSuccess("Login", res)) {
			console.log("info.usr=" + usr + " homeNodeOverride: " + res.homeNodeOverride);

			if (usr != "anonymous") {
				_.writeCookie(cnst.COOKIE_LOGIN_USR, usr);
				_.writeCookie(cnst.COOKIE_LOGIN_PWD, pwd);
				_.writeCookie(cnst.COOKIE_LOGIN_STATE, "1");
			}

			meta64.jqueryChangePage("#mainPage");

			_setStateVarsUsingLoginResponse(res);

			if (res.userPreferences.lastNode) {
				console.log("lastNode: " + res.userPreferences.lastNode);
			} else {
				console.log("lastNode is null.");
			}

			/* set ID to be the page we want to show user right after login */
			var id = null;
			if (!util.emptyString(res.homeNodeOverride)) {
				console.log("loading homeNodeOverride=" + res.homeNodeOverride);
				id = res.homeNodeOverride;
			} else {
				if (res.userPreferences.lastNode) {
					console.log("loading lastNode=" + res.userPreferences.lastNode);
					id = res.userPreferences.lastNode;
				} else {
					console.log("loading homeNodeId=" + meta64.homeNodeId);
					id = meta64.homeNodeId;
				}
			}

			view.refreshTree(id, false);
			_setTitleUsingLoginResponse(res);
		} else {
			if (usingCookies) {
				alert("Cookie login failed.");

				/*
				 * blow away failed cookie credentials and reload page, should
				 * result in brand new page load as anon user.
				 */
				$.removeCookie(cnst.COOKIE_LOGIN_USR);
				$.removeCookie(cnst.COOKIE_LOGIN_PWD);
				$.writeCookie(cnst.COOKIE_LOGIN_STATE, "0");
				location.reload();
			}
		}
	}

	var _refreshLoginResponse = function(res) {
		console.log("refreshLoginResponse");

		// if (res.success) {
		_setStateVarsUsingLoginResponse(res);
		_setTitleUsingLoginResponse(res);
		// }

		meta64.loadAnonPageHome(false);
	}

	var _logoutResponse = function(res) {
		/* reloads browser with the query parameters stripped off the path */
		window.location.href = window.location.origin;
	}

	var _changePasswordResponse = function(res) {
		if (util.checkSuccess("Change password", res)) {
			alert("Password changed successfully.");
		}
	}

	var _signupResponse = function(res) {
		if (util.checkSuccess("Signup new user", res)) {
			user.populateLoginPgFromCookies();
			meta64.changePage(loginPg);
			alert("User Information Accepted. \n\nCheck your email for signup confirmation. (Can take up to 1 minute)");
		}
	}

	var _twitterLoginResponse = function(res) {
		console.log("twitter Login response recieved.");
	}

	var _ = {

		twitterLogin : function() {
			/* Remove warning dialog to ask user about leaving the page */
			$(window).off("beforeunload");
			window.location.href = window.location.origin + "/twitterLogin";
		},

		openSignupPg : function() {
			meta64.changePage(signupPg);
		},

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
				// _.populateLoginPgFromCookies();
				//
				// /* make credentials visible only if not logged in */
				// util.setVisibility("#loginCredentialFields",
				// meta64.isAnonUser);

				meta64.changePage(loginPg);
			}
			/* or log out immediately */
			else {
				_.logout(true);
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
			var src = postTargetUrl + "captcha?t=" + n;
			// console.log("Setting captcha image src: "+src);

			$("#captchaImage").attr("src", src);
		},

		refreshLogin : function() {
			console.log("refreshLogin.");

			var callUsr, callPwd, usingCookies = false;
			var loginSessionReady = $("#loginSessionReady").text();
			if (loginSessionReady === "true") {
				console.log("    loginSessionReady = true");
				/*
				 * using blank credentials will cause server to look for a valid
				 * session
				 */
				callUsr = "";
				callPwd = "";
				usingCookies = true;
			} else {
				console.log("    loginSessionReady = false");

				var loginState = $.cookie(cnst.COOKIE_LOGIN_STATE);

				/* if we have known state as logged out, then do nothing here */
				if (loginState === "0") {
					meta64.loadAnonPageHome(false);
					return;
				}

				var usr = $.cookie(cnst.COOKIE_LOGIN_USR);
				var pwd = $.cookie(cnst.COOKIE_LOGIN_PWD);

				usingCookies = !util.emptyString(usr) && !util.emptyString(pwd);
				console.log("cookieUser=" + usr + " usingCookies = " + usingCookies);

				/*
				 * empyt credentials causes server to try to log in with any
				 * active session credentials.
				 */
				callUsr = usr ? usr : "";
				callPwd = pwd ? pwd : "";
			}

			console.log("refreshLogin with name: " + callUsr);

			var prms = util.json("login", {
				"userName" : callUsr,
				"password" : callPwd,
				"tzOffset" : new Date().getTimezoneOffset(),
				"dst" : util.daylightSavingsTime
			});

			if (usingCookies) {
				prms.done(function(res) {
					_loginResponse(res, callUsr, callPwd, usingCookies);
				});
			} else {
				prms.done(function(res) {
					_refreshLoginResponse(res);
				});
			}
		},

		login : function() {

			var usr = $.trim($("#userName").val());
			var pwd = $.trim($("#password").val());

			/*
			 * the json is in here twice because we happen to need to feed the
			 * same INFO to the _loginResponse method. I'll just cod it this way
			 * instead of creating a var to hold it.
			 */
			var prms = util.json("login", {
				"userName" : usr,
				"password" : pwd,
				"tzOffset" : new Date().getTimezoneOffset(),
				"dst" : util.daylightSavingsTime
			});

			prms.done(function(res) {
				_loginResponse(res, usr, pwd);
			});
		},

		logout : function(updateLoginStateCookie) {
			if (meta64.isAnonUser) {
				return;
			}

			/* Remove warning dialog to ask user about leaving the page */
			$(window).off("beforeunload");

			if (updateLoginStateCookie) {
				user.writeCookie(cnst.COOKIE_LOGIN_STATE, "0");
			}

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
			meta64.changePage(changePasswordPg);
		}
	};

	console.log("Module ready: user.js");
	return _;
}();

//# sourceURL=user.js
