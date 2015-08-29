console.log("running module: sharingPg.js");

var sharingPg = function() {

	var _ = {
		domId : "sharingPg",

		build : function() {

			var header = render.tag("div", //
			{
				"data-role" : "header"// ,
			// "data-position" : "fixed"
			// "data-tap-toggle" : "false"
			}, //
			"<h2>" + BRANDING_TITLE + " - Node Sharing</h2>");

			var shareWithPersonButton = render.makeButton("Share with Person", "shareNodeToPersonPgButton", "a");
			var makePublicButton = render.makeButton("Share to Public", "shareNodeToPublicButton", "a");
			var backButton = render.makeButton("Close", "closeSharingButton", "a");
			var buttonBar = render.makeHorzControlGroup(shareWithPersonButton + makePublicButton + backButton);

			var internalMainContent = "<div id='shareNodeNameDisplay'></div>" + //
			"<div id='sharingListFieldContainer'></div>";

			var mainContent = render.tag("div", //
			{
				"role" : "main", //
				"class" : "ui-content dialog-content"
			}, //
			internalMainContent + buttonBar);

			var content = header + mainContent;
			util.setHtmlEnhanced($("#sharingPg"), content);

			$("#shareNodeToPersonPgButton").on("click", share.shareNodeToPersonPg);
			$("#shareNodeToPublicButton").on("click", share.shareNodeToPublic);
			$("#closeSharingButton").on("click", share.closeSharingDlg);
		},

		init : function() {
			share.reload();
		}
	};

	console.log("Module ready: sharingPg.js");
	return _;
}();

//# sourceURL=sharingPg.js
