console.log("running module: loader.js");

/*
 * Performs dynamic/programmatic loading of multiple JavaScript files
 */
var loader = function() {

	var scriptsRemaining = 0;

	var _ = {
		/**
		 * Returns the promise that gets resolved once the script is loaded
		 */
		loadScript : function(url) {
			console.log("Requesting Script: " + url);

			var prms = jQuery.ajax({
				"dataType" : "script",
				"cache" : true,
				"url" : url
			});

			prms.fail(function(xhr, status, error) {
				/*
				 * Print large message on the page, adn nothing else will be
				 * showing on the page
				 */
				$("#mainPage").html("<h2>Application Load Failed.</h2>");

				/*
				 * If there is a syntax error in the script this will not be
				 * able to show the line number, however we are using Google
				 * Closure Compiler to detect script problems, so if this
				 * happens during development, simply running the builder will
				 * list any JS errors on the console.
				 */
				console.error("ERROR: url=" + url + " status[" + status + "] error: " + error);
			});

			return prms;
		},

		/*
		 * scripts: array of script names (urls)
		 */
		loadScripts : function(scripts, allScriptsLoaded) {
			var len = scripts.length;
			console.log("Loading " + len + " scripts.");
			scriptsRemaining += len;
			var deferreds = [];

			for (var i = 0; i < len; i++) {
				var script = scripts[i];
				console.log("Script: " + script);

				var prms = _.loadScript(script + "?ver=" + cacheVersion);

				(function(script) {

					prms.done(function() {
						scriptsRemaining--;
						console.log("Script Loaded Ok. [" + script
								+ "] remaining=" + scriptsRemaining);
						
						if (scriptsRemaining == 0) {
							console.log("All scripts loaded!");
							/*
							 * It would be perfectly acceptable to call the
							 * allScriptsLoaded here but we will go ahead and
							 * use the deferreds approach instead. So the
							 * "when.apply" below handles this.
							 */
							// allScriptsLoaded();
						}
					});
				})(script);

				deferreds.push(prms);
			}

			$.when.apply(jQuery, deferreds).done(allScriptsLoaded);
		}
	};

	console.log("Module ready: loader.js");
	return _;
}();

// # sourceURL=scriptLoader.js
