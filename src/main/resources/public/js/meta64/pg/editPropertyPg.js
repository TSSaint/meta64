console.log("running module: editPropertyPg.js");

var editPropertyPg = function() {

	var _ = {
		domId : "editPropertyPg",
		tabId : "dialogsTabName",
		visible : false,

		build : function() {

			var header = "<h2>Edit Node Property</h2>";

			var savePropertyButton = render.makeBackButton("Save", "savePropertyButton", _.domId, "props.saveProperty();");
			var cancelEditButton = render.makeBackButton("Cancel", "editPropertyPgCloseButton", _.domId);
			
			var buttonBar = render.makeHorzControlGroup(savePropertyButton + cancelEditButton);

			var internalMainContent = "<div id='editPropertyPathDisplay' class='path-display-in-editor'></div>" + //
			"<div id='addPropertyFieldContainer' class='ui-field-contain'></div>";

			var mainContent = internalMainContent + buttonBar;

			var content = header + mainContent;

			util.setHtmlEnhanced("editPropertyPg", content);
		},

		init : function() {
			props.populatePropertyEdit();
		}
	};

	console.log("Module ready: editPropertyPg.js");
	return _;
}();

//# sourceURL=editPropertyPg.js
