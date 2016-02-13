console.log("running module: SharingDlg.js");

/*
 * Class constructor
 */
var SharingDlg = function() {
	// boiler plate for inheritance
	Dialog.call(this);
	
	this.domId = "SharingDlg";
}

// more boilerplate for inheritance
SharingDlg.prototype.constructor = SharingDlg;
util.inherit(Dialog, SharingDlg);

/*
 * Returns a string that is the HTML content of the dialog
 */
SharingDlg.prototype.build = function() {
	var header = render.makeDialogHeader("Node Sharing");

	var shareWithPersonButton = this.makeButton("Share with Person", "shareNodeToPersonPgButton", SharingDlg.prototype.shareNodeToPersonPg, this);
	var makePublicButton = this.makeButton("Share to Public", "shareNodeToPublicButton", SharingDlg.prototype.shareNodeToPublic, this);
	var backButton = this.makeCloseButton("Close", "closeSharingButton");
	
	var buttonBar = render.centeredButtonBar(shareWithPersonButton + makePublicButton + backButton);

	var width = window.innerWidth * 0.6;
	var height = window.innerHeight * 0.4;
	
	var internalMainContent = "<div id='"+this.id("shareNodeNameDisplay")+"'></div>" + //
	"<div style=\"width:" + width + "px;height:" + height + "px;overflow:scroll;\" id='"+this.id("sharingListFieldContainer")+"'></div>";

	return header + internalMainContent + buttonBar;
}

SharingDlg.prototype.init = function() {
	this.reload();
}

/*
 * Gets privileges from server and displays in GUI also. Assumes gui is
 * already at correct page.
 */
SharingDlg.prototype.reload = function() {
	console.log("Loading node sharing info.");

	util.json("getNodePrivileges", {
		"nodeId" : share.sharingNode.id,
		"includeAcl" : true,
		"includeOwners" : true
	}, SharingDlg.prototype.getNodePrivilegesResponse, this);
}

/*
 * Handles getNodePrivileges response.
 * 
 * res=json of GetNodePrivilegesResponse.java
 * 
 * res.aclEntries = list of AccessControlEntryInfo.java json objects
 */
SharingDlg.prototype.getNodePrivilegesResponse = function(res) {
	this.populateSharingPg(res);
}

/*
 * Processes the response gotten back from the server containing ACL
 * info so we can populate the sharing page in the gui
 */
SharingDlg.prototype.populateSharingPg = function(res) {

	var html = "";
	var This = this;

	$.each(res.aclEntries, function(index, aclEntry) {
		html += "<h4>User: " + aclEntry.principalName + "</h4>";
		html += render.tag("div", {
			"class" : "privilege-list"
		}, This.renderAclPrivileges(aclEntry.principalName, aclEntry));
	});

	/* todo: use actual polymer paper-checkbox here */
	html += render.tag("input", {
		"type" : "checkbox",
		"name" : "allowPublicCommenting",
		"id" : this.id("allowPublicCommenting")
	}, "", false);

	html += render.tag("label", {
		"for" : this.id("allowPublicCommenting")
	}, "Allow public commenting under this node.", true);

	util.setHtmlEnhanced(this.id("sharingListFieldContainer"), html);

	util.setCheckboxVal("#"+this.id(allowPublicCommenting), res.publicAppend);
	
	//todo: this binding may not work. untested.
	$("#"+this.id("allowPublicCommenting")).bind("change", this.publicCommentingChanged);
}

SharingDlg.prototype.removePrivilege = function(principal, privilege) {
	/*
	 * Trigger going to server at next main page refresh
	 */
	meta64.treeDirty = true;

	util.json("removePrivilege", {
		"nodeId" : share.sharingNode.id,
		"principal" : principal,
		"privilege" : privilege
	}, SharingDlg.prototype.removePrivilegeResponse, this);
}

SharingDlg.prototype.removePrivilegeResponse = function(res) {

	util.json("getNodePrivileges", {
		"nodeId" : share.sharingNode.path,
		"includeAcl" : true,
		"includeOwners" : true
	}, SharingDlg.prototype.getNodePrivilegesResponse, this);
}

SharingDlg.prototype.renderAclPrivileges = function(principal, aclEntry) {
	var ret = "";
	var thiz = this;
	$.each(aclEntry.privileges, function(index, privilege) {

		var removeButton = thiz.makeButton("Remove", "removePrivButton", //
				"meta64.getObjectByGuid("+thiz.guid+").removePrivilege('" + principal + "', '" + privilege.privilegeName + "');");

		var row = render.makeHorizontalFieldSet(removeButton);

		row += "<b>" + principal + "</b> has privilege <b>" + privilege.privilegeName + "</b> on this node.";

		ret += render.tag("div", {
			"class" : "privilege-entry"
		}, row);
	});
	return ret;
}

SharingDlg.prototype.shareNodeToPersonPg = function() {
	(new ShareToPersonDlg()).open();
}

SharingDlg.prototype.shareNodeToPublic = function() {
	console.log("Sharing node to public.");

	/*
	 * Trigger going to server at next main page refresh
	 */
	meta64.treeDirty = true;

	/*
	 * Add privilege and then reload share nodes dialog from scratch
	 * doing another callback to server
	 * 
	 * TODO: this additional call can be avoided as an optimization 
	 */
	util.json("addPrivilege", {
		"nodeId" : share.sharingNode.id,
		"principal" : "everyone",
		"privileges" : [ "read" ]
	}, SharingDlg.prototype.reload, this);
}

//# sourceURL=SharingDlg.js
