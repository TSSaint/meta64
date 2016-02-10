console.log("running module: prefs.js");

var prefs = function() {

	var _ = {
		savePreferencesResponse : function(res) {
			if (util.checkSuccess("Saving Preferences", res)) {
				meta64.selectTab("mainTabName");
				view.scrollToSelectedNode();
			}
		},

		closeAccountResponse : function() {
			/* Remove warning dialog to ask user about leaving the page */
			$(window).off("beforeunload");

			/* reloads browser with the query parameters stripped off the path */
			window.location.href = window.location.origin;
		},

		closeAccount : function() {
			(new ConfirmDlg("Oh No!", "Close your Account? Are you sure? This was so unexpected!",
					"Yes, Close Account.", function() {
						util.json("closeAccount", {}, _.closeAccountResponse);
					})).open();
		},

		savePreferences : function() {
			var polyElm = util.polyElm("simpleModeRadioGroup");
			meta64.editModeOption = polyElm.node.selected=="editModeSimple" ? meta64.MODE_SIMPLE :  meta64.MODE_ADVANCED;
			
			util.json("saveUserPreferences", {
				"userPreferences" : {
					"advancedMode" : meta64.editModeOption === meta64.MODE_ADVANCED
				}
			}, _.savePreferencesResponse);
		}
	};

	console.log("Module ready: prefs.js");
	return _;
}();

//# sourceURL=prefs.js
