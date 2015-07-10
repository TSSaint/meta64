console.log("running module: render.js");

var render = function() {

	/* Holds the function that performs markdown conversion, and is set lazily */
	var _markdown;

	/*
	 * This is the content displayed when the user signs in, and we see that
	 * they have no content being displayed. We want to give them some
	 * insructions and the ability to add content.
	 */
	function _getEmptyPagePrompt() {
		//TODO: oops, anonymous users had access to this button. LOL.
		return "";
//		/* Construct Create Subnode Button */
//		var createSubNodeButton = _.makeTag("a", //
//		{
//			"onClick" : "edit.createSubNode();",
//			"data-role" : "button",
//			"data-icon" : "star"
//		}, "Create Content");
//
//		return createSubNodeButton;
	}

	function _renderBinary(node) {
		/*
		 * If this is an image render the image directly onto the page as a
		 * visible image
		 */
		if (node.binaryIsImage) {
			return _.makeImageTag(node);
		}
		/*
		 * If not an image we render a link to the attachment, so that it can be
		 * downloaded.
		 */
		else {
			var anchor = _.makeTag("a", {
				"href" : _.getUrlForNodeAttachment(node)
			}, "[Download Attachment]");

			return _.makeTag("div", {
				"class" : "binary-link",
			}, anchor);
		}
	}

	var _ = {
		/*
		 * node: JSON of NodeInfo.java
		 */
		renderNodeContent : function(node, showIdentifier, showPath, showName, renderBinary) {
			var ret = '';

			if (showPath) {
				var path = meta64.isAdminUser ? node.path : node.path.replaceAll("/jcr:root", "");
				/* tail end of path is the name, so we can strip that off */
				// path = path.replace(node.name, "");
				ret += "Path: " + _.formatPath(path) + "<br>";
			}

			if (showIdentifier) {
				if (node.id === node.path && showPath) {
					// ret += "ID: *<br>";
				} else {
					/*
					 * if ID contains a slash then it's more path than ID, so I
					 * won't show it as an ID. This is kind of confusing how JCR
					 * will put in the ID as a path component, which is valid
					 * but then again it's not an ID either.
					 */
					// if (!node.id.contains("/")) {
					ret += "ID: " + node.id + "<br>";
					// }
				}
			}

			/*
			 * on root node name will be empty string so don't show that
			 * 
			 * commenting: I decided users will understand the path as a single
			 * long entity with less confusion than breaking out the name for
			 * them. They already unserstand internet URLs. This is the same
			 * concept. No need to baby them.
			 * 
			 * The !showPath condition here is because if we are showing the
			 * path then the end of that is always the name, so we don't need to
			 * show the path AND the name. One is a substring of the other.
			 */
			if (showName && !showPath && node.name) {
				ret += "Name: " + node.name + " [uid=" + node.uid + "]";
			}

			if (meta64.showProperties) {
				// console.log("showProperties = " +
				// meta64.showProperties);
				var properties = props.renderProperties(node.properties);
				if (properties) {
					ret += /* "<br>" + */properties;
				}
			} else {
				var contentProp = props.getNodeProperty("jcr:content", node);
				if (contentProp) {
					var jcrContent = props.renderProperty(contentProp);

					ret += _.makeTag("div", {
						"class" : "jcr-content"
					}, _.markdown(jcrContent));
				}
			}
			if (renderBinary && node.hasBinary) {
				ret += _renderBinary(node);
			}
			return ret;
		},

		/*
		 * This is the primary method for rendering each node (like a row) on
		 * the main HTML page that displays node content. This generates the
		 * HTML for a single row/node.
		 * 
		 * node is a NodeInfo.java JSON
		 */
		renderNodeAsListItem : function(node, index, count, rowCount) {

			var uid = node.uid;
			var selected = (node.id === meta64.newChildNodeId);
			var canMoveUp = index > 0 && rowCount > 1;
			var canMoveDown = index < count - 1;

			/*
			 * this checking of "rep:" is just a hack for now to stop from
			 * deleting things I won't want to allow to delete, but I will
			 * design this better later.
			 */
			var isRep = node.name.startsWith("rep:") || meta64.currentNodeData.node.path.contains("/rep:");
			var editingAllowed = meta64.isAdminUser || !isRep;

			/*
			 * if not selected by being the new child, then we try to select
			 * based on if this node was the last one clicked on for this page.
			 */
			// console.log("test: [" + parentIdToFocusIdMap[currentNodeId]
			// +"]==["+ node.id + "]")
			var focusNode = meta64.parentUidToFocusNodeMap[meta64.currentNodeUid];
			if (!selected && focusNode && focusNode.uid === uid) {
				selected = true;
			}

			var cssId = uid + "_row";
			// console.log("Rendering Node Row[" + index + "] with id: " +cssId)
			return _.makeTag("div", //
			{
				"class" : "node-table-row" + (selected ? " active-row" : " inactive-row"),
				"onClick" : "nav.clickOnNodeRow(this, '" + uid + "');", //
				"id" : cssId
			},// 
			_.makeButtonBarHtml(uid, canMoveUp, canMoveDown, editingAllowed) + _.makeTag("div", //
			{
				"id" : uid + "_content"
			}, _.renderNodeContent(node, true, true, true, true)));
		},

		makeButtonBarHtml : function(uid, canMoveUp, canMoveDown, editingAllowed) {

			var openButton = selButton = createSubNodeButton = deleteNodeButton = editNodeButton = //
			moveNodeUpButton = moveNodeDownButton = insertNodeButton = editNodeSharingButton = uploadButton = '';

			/* Construct Open Button */
			if (_.nodeHasChildren(uid)) {
				openButton = _.makeTag("a", //
				{
					"onClick" : "nav.openNode('" + uid + "');", //
					"data-role" : "button",
					"data-icon" : "plus",
					"data-theme" : "b"
				}, //
				"Open");
			}

			/* Construct SelectButton */
			var checkboxHtml = _.makeTag("input", //
			{
				"type" : "checkbox", //
				"id" : uid + "_sel",//
				"name" : uid + "_check", //
				"onClick" : "nav.toggleNodeSel('" + uid + "')",
				"data-icon" : "bullets"
			}, "", false);
			selButton = _.makeTag("label", null, checkboxHtml + "Sel");

			/*
			 * If in edit mode we always at least create the potential (buttons)
			 * for a user to insert content, and if they don't have privileges
			 * the server side security will let them know. In the future we can
			 * add more intelligence to when to show these buttons or not.
			 */
			if (meta64.editMode) {
				// console.log("Editing allowed: " + nodeId);

				/* Construct Create Subnode Button */
				createSubNodeButton = _.makeTag("a", //
				{
					"onClick" : "edit.createSubNode('" + uid + "');",
					"data-role" : "button",
					"data-icon" : "star"
				}, "New");

				/* Construct Create Subnode Button */
				insertNodeButton = _.makeTag("a", //
				{
					"onClick" : "edit.insertNode('" + uid + "');",
					"data-role" : "button",
					"data-icon" : "bars"
				}, "Ins");
			}

			if (meta64.editMode && editingAllowed) {
				/* Construct Create Subnode Button */
				deleteNodeButton = _.makeTag("a", //
				{
					"onClick" : "edit.deleteNode('" + uid + "');",
					"data-role" : "button",
					"data-icon" : "delete"
				}, "Del");

				/* Construct Create Subnode Button */
				editNodeButton = _.makeTag("a", //
				{
					"onClick" : "edit.runEditNode('" + uid + "');",
					"data-role" : "button",
					"data-icon" : "edit"
				}, "Edit");

				/* Construct Create Subnode Button */
				uploadButton = _.makeTag("a", //
				{
					"onClick" : "attachment.openUploadDialog('" + uid + "');",
					"data-role" : "button",
					"data-icon" : "action"
				}, "Upload");

				if (meta64.currentNode.childrenOrdered) {

					if (canMoveUp) {
						/* Construct Create Subnode Button */
						moveNodeUpButton = _.makeTag("a", //
						{
							"onClick" : "edit.moveNodeUp('" + uid + "');",
							"data-role" : "button",
							"data-icon" : "arrow-u"
						}, "Up");
					}

					if (canMoveDown) {
						/* Construct Create Subnode Button */
						moveNodeDownButton = _.makeTag("a", //
						{
							"onClick" : "edit.moveNodeDown('" + uid + "');",
							"data-role" : "button",
							"data-icon" : "arrow-d"
						}, "Dn");
					}
				}

				/* Construct Create Subnode Button */
				editNodeSharingButton = _.makeTag("a", //
				{
					"onClick" : "share.editNodeSharing('" + uid + "');",
					"data-role" : "button",
					"data-icon" : "eye"
				}, "Share");
			}

			return _.makeHorizontalFieldSet(selButton + openButton + insertNodeButton + createSubNodeButton + editNodeButton + uploadButton
					+ deleteNodeButton + moveNodeUpButton + moveNodeDownButton + editNodeSharingButton);
		},

		makeHorizontalFieldSet : function(content) {
			/* Now build entire control bar */
			var buttonBar = _.makeTag("fieldset", //
			{
				"data-role" : "controlgroup", //
				"data-type" : "horizontal"
			}, content);

			return _.makeTag("div", {
				"class" : "ui-field-contain"
			}, buttonBar);
		},

		/*
		 * Returns true if the nodeId (see makeNodeId()) NodeInfo object has
		 * 'hasChildren' true
		 */
		nodeHasChildren : function(uid) {
			var node = meta64.uidToNodeMap[uid];
			if (!node) {
				console.log("Unknown nodeId in nodeHasChildren: " + uid);
				return false;
			} else {
				return node.hasChildren;
			}
		},

		formatPath : function(path) {
			return meta64.isAdminUser ? path : path.replaceAll("/jcr:root", "");
		},

		markdown : function(text) {

			/*
			 * I will lazy load this function just in case this helps overall
			 * app startup time
			 */
			if (!_markdown) {
				_markdown = new Markdown.getSanitizingConverter().makeHtml;
			}

			return _markdown(text);
		},

		/*
		 * Each page can show buttons at the top of it (not main header buttons
		 * but additional buttons just for that page only, and this genates that
		 * content for that entire control bar.
		 */
		renderMainPageControls : function() {
			var html = '';

			if (srch.numSearchResults() > 0) {

				html += render.makeTag("a", //
				{
					"onClick" : "nav.showSearchPage();", //
					"data-role" : "button",
					"data-icon" : "search"
				}, //
				"Back to Search Results");
			}

			var hasContent = html.length > 0;
			if (hasContent) {
				// $("#mainPageControls").html(html);
				util.setHtmlEnhanced($("#mainPageControls"), html);
			}

			util.setVisibility("#mainPageControls", hasContent)
		},

		renderPageFromData : function(data) {

			var newData = false;
			if (!data) {
				data = meta64.currentNodeData;
			} else {
				newData = true;
			}

			if (!data || !data.node) {
				util.setVisibility("#listView", false);
				$("#mainNodeContent").html("No default content is available.");
				return;
			} else {
				util.setVisibility("#listView", true);
			}

			_.renderMainPageControls();

			meta64.treeDirty = false;

			if (newData) {
				meta64.uidToNodeMap = {};
				meta64.initNode(data.node);
				meta64.setCurrentNodeData(data);
			}

			var propCount = meta64.currentNode.properties ? meta64.currentNode.properties.length : 0;
			// console.log("RENDER NODE: " + data.node.id + propertyCount=" +
			// propCount);
			var output = '';

			$("#mainNodeContent").html(_.renderNodeContent(data.node, true, false /*
																					 * show
																					 * path
																					 */, false, false));
			view.updateStatusBar();

			_.renderMainPageControls();

			if (data.children) {
				var childCount = data.children.length;
				console.log("childCount: " + childCount);
				/*
				 * Number of rows that have actually made it onto the page to
				 * far. Note: some nodes get filtered out on the client side for
				 * various reasons.
				 */
				var rowCount = 0;

				$.each(data.children, function(i, node) {
					if (meta64.isNodeBlackListed(node))
						return;

					if (newData) {
						meta64.initNode(node);

						// console.log(" RENDER ROW[" + i + "]: node.id=" +
						// node.id);

						/*
						 * if no row is selected for this parent, select the
						 * first row
						 */
						if (!meta64.parentUidToFocusNodeMap[meta64.currentNodeUid]) {
							meta64.parentUidToFocusNodeMap[meta64.currentNodeUid] = node;

							if (!node.uid) {
								alert("oops, node.uid is null");
							}
							// console.log("Setting default row selection to
							// this
							// top
							// row");
						} else {
							// console.log(" SEL ROW
							// KNOWN:"+parentIdToFocusIdMap[meta64.currentNodeData.node.id]);
						}
					}

					rowCount++;
					output += _.renderNodeAsListItem(node, i, childCount, rowCount);
				});
			}

			if (output.length == 0) {
				output = _getEmptyPagePrompt();
			}

			util.setHtmlEnhanced($("#listView"), output);

			view.scrollToSelectedNode();
		},

		getUrlForNodeAttachment : function(node) {
			return postTargetUrl + "bin?nodeId=" + encodeURIComponent(node.path + "/nt:bin") + "&ver=" + node.binVer;
		},

		makeImageTag : function(node) {
			if (node.width && node.height) {
				return _.makeTag("img", {
					"src" : _.getUrlForNodeAttachment(node),
					"width" : node.width+"px",
					"height" : node.height+"px"
				}, null, false);
			} else {
				return _.makeTag("img", {
					"src" : _.getUrlForNodeAttachment(node)
				}, null, false);
			}
		},

		/*
		 * creates HTML tag with all attributes/values specified in attributes
		 * object, and closes the tag also if content is non-null
		 */
		makeTag : function(tag, attributes, content, closeTag) {

			/* default parameter values */
			if (typeof (closeTag) === 'undefined')
				closeTag = true;

			/* HTML tag itself */
			var ret = "<" + tag;

			if (attributes) {
				ret += " ";
				$.each(attributes, function(k, v) {
					/*
					 * we intelligently wrap strings that contain single quotes
					 * in double quotes and vice versa
					 */
					if (v.contains("'")) {
						ret += k + "=\"" + v + "\" ";
					} else {
						ret += k + "='" + v + "' ";
					}
				});
			}

			if (closeTag) {
				ret += ">" + content + "</" + tag + ">";
			} else {
				ret += "/>";
			}

			return ret;
		},

		allowPropertyToDisplay : function(propName) {
			return meta64.simpleModePropertyBlackList[propName] == null;
		},

		isReadOnlyProperty : function(propName) {
			return meta64.readOnlyPropertyList[propName];
		},

		isBinaryProperty : function(propName) {
			return meta64.binaryPropertyList[propName];
		},

		sanitizePropertyName : function(propName) {
			if (meta64.editModeOption === "simple") {
				return propName === "jcr:content" ? "Content" : propName;
			} else {
				return propName;
			}
		}
	};

	console.log("Module ready: render.js");
	return _;
}();