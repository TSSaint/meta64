console.log("running module: searchPg.js");

var searchPg = function() {

	var _ = {
			domId : "searchPg",
		build : function() {

			var header = render.tag("div", //
			{
				"data-role" : "header"//,
				//"data-position" : "fixed",
				//"data-tap-toggle" : "false"
			}, //
			"<h2>" + BRANDING_TITLE + " - Search</h2>");

			var formControls = render.makeEditField("Search", "searchText");

			var searchButton = render.makeButton("Search", "searchNodesButton", "b", "ui-btn-icon-left ui-icon-check");
			var backButton = render.makeBackButton("Close", "cancelSearchButton", "a");
			var buttonBar = render.makeHorzControlGroup(searchButton + backButton);

			var form = render.tag("div", //
			{
				"class" : "ui-field-contain" //
			}, //
			formControls + buttonBar);

			var internalMainContent = "";
			var mainContent = render.tag("div", //
			{
				"role" : "main", //
				"class" : "ui-content dialog-content"
			}, //
			internalMainContent + form);

			var content = header + mainContent;

			util.setHtmlEnhanced($("#searchPg"), content);

			$("#searchNodesButton").on("click", srch.searchNodes);
			
			util.bindEnterKey("#searchText", srch.searchNodes)
		},
		
		init : function() {
			util.delayedFocus("#searchText");
		}
	};

	console.log("Module ready: searchPg.js");
	return _;
}();

//# sourceURL=searchPg.js
