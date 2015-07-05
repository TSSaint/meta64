console.log("running module: edit.js");

var edit = function() {

	/*
	 * ================= PRIVATE =================
	 */
	/*
	 * node (NodeInfo.java) that is being created under when new node is created
	 */
	var _parentOfNewNode;

	var _saveNodeResponse = function(res) {
		console.log("saveNode_response running.");

		if (!res.success) {
			alert("Save node failed: " + res.message);
		}
		view.refreshTree();
		$.mobile.changePage("#mainPage");
		view.scrollToSelectedNode();
	}

	var _insertBookResponse = function(res) {
		console.log("insertBookResponse running.");

		if (!res.success) {
			alert("Insert book failed: " + res.message);
		}
		view.refreshTree();
		$.mobile.changePage("#mainPage");
		view.scrollToSelectedNode();
	}

	var _deleteNodeResponse = function(res) {
		if (!res.success) {
			alert("Delete node failed: " + res.message);
		}
		view.refreshTree();
	}

	var _setNodePositionResponse = function(res) {
		if (!res.success) {
			alert("Set node position failed: " + res.message);
		}

		view.refreshTree();
		$.mobile.changePage("#mainPage");
		view.scrollToSelectedNode();
	}

	var _insertNodeResponse = function(res) {
		if (!res.success) {
			alert("Insert node failed: " + res.message);
		}

		/*
		 * set newChildNodeId and also map it to the currently selected node
		 * under the current page parent
		 */
		/*
		 * TODO: verify this value gets used now that we aren't going
		 * IMMEDIATELY to the treeview after creates
		 */
		meta64.newChildNodeId = res.newNode.id;
		console.log("new child identifier: " + meta64.newChildNodeId);

		/*
		 * todo: initNode needed here ?
		 */
		meta64.parentUidToFocusNodeMap[meta64.currentNodeUid] = res.newNode;

		meta64.initNode(res.newNode);
		edit.runEditNode(res.newNode.uid);
	}

	var _makeNodeReferencableResponse = function(res) {
		if (!res.success) {
			alert("Failed to make node referencable: " + res.message);
		}
	}

	var _createSubNodeResponse = function(res) {
		if (!res.success) {
			alert("Create Subnode failed: " + res.message);
		}

		/*
		 * TODO: verify this value gets used now that we aren't going
		 * IMMEDIATELY to the treeview after creates
		 */
		meta64.newChildNodeId = res.newNode.id;
		console.log("new child identifier: " + meta64.newChildNodeId);

		meta64.initNode(res.newNode);
		edit.runEditNode(res.newNode.uid);
	}

	/*
	 * ================= PUBLIC =================
	 */
	var _ = {
		/*
		 * indicates editor is displaying a node that is not yet saved on the
		 * server
		 */
		editingUnsavedNode : false,

		/* Node being edited */
		editNode : null,

		/*
		 * type=NodeInfo.java
		 * 
		 * When inserting a new node, this holds the node that was clicked on at
		 * the time the insert was requested, and is sent to server for ordinal
		 * position assignment of new node. Also if this var is null, it
		 * indicates we are creating in a 'create under parent' mode, versus
		 * non-null meaning 'insert inline' type of insert.
		 * 
		 */
		nodeInsertTarget : null,

		/*
		 * called to display editor that will come up BEFORE any node is saved
		 * onto the server, so that the first time any save is performed we will
		 * have the correct node name, at least.
		 */
		startEditingNewNode : function() {
			_.editingUnsavedNode = true;
			_.editNode = null;

			_.populateEditNodeDialog();
			$.mobile.changePage("#editNodeDialog");
		},

		editMode : function() {
			meta64.editMode = meta64.editMode ? false : true;
			// setDataIconUsingId("#editModeButton", editMode ? "edit" :
			// "forbidden");
			var elm = $("#editModeButton");
			elm.toggleClass("ui-icon-edit", meta64.editMode);
			elm.toggleClass("ui-icon-forbidden", !meta64.editMode);
			render.renderPageFromData();
		},

		makeNodeReferencable : function() {
			util.json("makeNodeReferencable", {
				"nodeId" : _.editNode.id,
			}, _makeNodeReferencableResponse);
		},

		cancelEdit : function() {

			if (meta64.treeDirty) {
				/*
				 * TODO: this results in a call to the server to refresh page
				 * which CAN be avoided if I write smarter client-side code, but
				 * for now, to get a product up and running soon, i'm just
				 * calling refresh here for a full blown call to server to
				 * refresh.
				 */
				// console.log("cancel edit, detected dirty, and will call
				// server.");
				view.refreshTree();

				/*
				 * if I had the logic in place to simply update client variables
				 * then I could call this simply (and avoid a call to server)
				 */
				// renderPageFromData(currentNodeData);
			}
			$.mobile.changePage("#mainPage");
			view.scrollToSelectedNode();
		},

		/*
		 * for now just let server side choke on invalid things. It has enough
		 * security and validation to at least protect itself from any kind of
		 * damage.
		 */
		saveNode : function() {

			/*
			 * If editing an unsaved node it's time to run the insertNode, or
			 * createSubNode, which actually saves onto the server, and will
			 * initiate further editing like for properties, etc.
			 */
			if (_.editingUnsavedNode) {
				_.saveNewNode();
			}
			/*
			 * Else we are editing a saved node, which is already saved on
			 * server.
			 */
			else {
				_.saveExistingNode();
			}
		},

		saveNewNode : function() {
			var newNodeName = util.getRequiredElement("#newNodeNameId").val();

			console.log("Sending up first node name: " + newNodeName);

			meta64.treeDirty = true;
			if (_.nodeInsertTarget) {
				util.json("insertNode", {
					"parentId" : _parentOfNewNode.id,
					"targetName" : _.nodeInsertTarget.name,
					"newNodeName" : newNodeName
				}, _insertNodeResponse);
			} else {
				util.json("createSubNode", {
					"nodeId" : _parentOfNewNode.id,
					"newNodeName" : newNodeName
				}, _createSubNodeResponse);
			}
		},

		saveExistingNode : function() {
			var propertiesList = [];
			var counter = 0;
			var changeCount = 0;

			// iterate for all fields we can find
			while (true) {
				var fieldId = "editNodeTextContent" + counter;

				/* is this an existing gui edit field */
				if (meta64.fieldIdToPropMap.hasOwnProperty(fieldId)) {
					var prop = meta64.fieldIdToPropMap[fieldId];

					// alert('prop found: ' + prop.name);
					var propVal = $("#" + fieldId).val();

					// TODO: handle 'values' (multi)
					if (propVal !== prop.value) {
						// alert("change detected: " + propVal);
						propertiesList.push({
							"name" : prop.name,
							"value" : propVal
						});

						changeCount++;
					}
				} else {
					break;
				}
				counter++;
			}

			if (changeCount > 0) {
				var postData = {
					nodeId : _.editNode.id,
					properties : propertiesList
				};
				// alert(JSON.stringify(postData));
				util.json("saveNode", postData, _saveNodeResponse);
			} else {
				alert("You didn't change any information!");
			}
		},

		moveNodeUp : function(uid) {
			var node = meta64.uidToNodeMap[uid];
			if (node) {
				var ordinal = meta64.getOrdinalOfNode(node);
				console.log("ordinal=" + ordinal);
				if (ordinal == -1 && ordinal <= 0)
					return;
				var nodeAbove = meta64.currentNodeData.children[ordinal - 1];

				util.json("setNodePosition", {
					"parentNodeId" : meta64.currentNodeId,
					"nodeId" : node.name,
					"siblingId" : nodeAbove.name
				}, _setNodePositionResponse);
			} else {
				console.log("idToNodeMap does not contain " + uid);
			}
		},

		moveNodeDown : function(uid) {
			var node = meta64.uidToNodeMap[uid];
			if (node) {
				var ordinal = meta64.getOrdinalOfNode(node);
				console.log("ordinal=" + ordinal);
				if (ordinal == -1 && ordinal >= meta64.currentNodeData.children.length - 1)
					return;
				var nodeBelow = meta64.currentNodeData.children[ordinal + 1];

				util.json("setNodePosition", {
					"parentNodeId" : meta64.currentNodeData.node.id,
					"nodeId" : nodeBelow.name,
					"siblingId" : node.name
				}, _setNodePositionResponse);
			} else {
				console.log("idToNodeMap does not contain " + uid);
			}
		},

		runEditNode : function(uid) {
			var node = meta64.uidToNodeMap[uid];
			if (!node) {
				_.editNode = null;
				alert("Unknown nodeId in editNodeClick: " + uid);
				return;
			}
			_.editingUnsavedNode = false;
			_.editNode = node;
			_.populateEditNodeDialog();
			$.mobile.changePage("#editNodeDialog");
		},

		/*
		 * Generates all the HTML edit fields and puts them into the DOM model
		 * of the property editor dialog box.
		 * 
		 * node is of type NodeInfo.java
		 */
		populateEditNodeDialog : function() {

			/* display the node path at the top of the edit page */
			view.initEditPathDisplayById("#editNodePathDisplay");

			var fields = '';
			var counter = 0;

			/* clear this map to get rid of old properties */
			meta64.fieldIdToPropMap = {};

			/* TODO: this block of code nests to deep. clean this up! */
			if (_.editNode) {
				// Iterate PropertyInfo.java objects
				$.each(_.editNode.properties, function(index, prop) {
					if (!render.allowPropertyToDisplay(prop.name)) {
						console.log("Hiding property: " + prop.name);
						return;
					}

					var fieldId = "editNodeTextContent" + counter;

					meta64.fieldIdToPropMap[fieldId] = prop;
					var isMulti = prop.values && prop.values.length > 0;

					var isReadOnlyProp = render.isReadOnlyProperty(prop.name);
					var isBinaryProp = render.isBinaryProperty(prop.name);

					/*
					 * this is the way (for now) that we make sure this node
					 * won't be attempted to be saved. If it has RdOnly_ prefix
					 * it won't be found by the saving logic.
					 */
					if (isReadOnlyProp || isBinaryProp) {
						fieldId = "RdOnly_" + fieldId;
					}

					var buttonBar = "";

					if (!isReadOnlyProp) {
						var clearButton = render.makeTag("a", //
						{
							"onClick" : "props.clearProperty('" + fieldId + "');", //
							"data-role" : "button",
							"data-icon" : "carat-l"
						}, //
						"Clear");

						var deleteButton = render.makeTag("a", //
						{
							"onClick" : "props.deleteProperty('" + prop.name + "');", //
							"data-role" : "button",
							"data-icon" : "delete"
						}, //
						"Del");

						var addMultiButton = "";
						/*
						 * I don't think it really makes sense to allow a
						 * jcr:content property to be multivalued. I may be
						 * wrong but this is my current assumption
						 */
						if (prop.name !== "jcr:content") {
							addMultiButton = render.makeTag("a", //
							{
								"onClick" : "props.addSubProperty('" + fieldId + "');", //
								"data-role" : "button",
								"data-icon" : "star"
							}, //
							"Add Multi");
						}

						buttonBar = render.makeHorizontalFieldSet(/*selButton + */ addMultiButton + clearButton + deleteButton);
					}

					var field = buttonBar;

					if (isMulti) {
						console.log("Property multi-type: name=" + prop.name + " count=" + prop.values.length);
						field += props.makeMultiPropEditor(fieldId, prop, isReadOnlyProp, isBinaryProp);
					} else {
						console.log("Property single-type: " + prop.name);
						field += render.makeTag("label", {
							"for" : fieldId
						}, render.sanitizePropertyName(prop.name));

						var propVal = isBinaryProp ? "[binary]" : prop.value;

						if (isReadOnlyProp || isBinaryProp) {
							field += render.makeTag("textarea", {
								"id" : fieldId,
								"readonly" : "readonly",
								"disabled" : "disabled"
							}, propVal ? propVal : '');
						} else {
							field += render.makeTag("textarea", {
								"id" : fieldId
							}, propVal ? propVal : '');
						}
					}

					/*
					 * NO MATTER WHAT I did, a fieldset breaks the ability to
					 * show labels
					 */
					// todo: what's the deal with fieldset v.s. form as the
					// element
					// to
					// contain a controlgroup ? not all combos work
					// apparently.
					// <fieldset data-role="controlgroup"
					// data-type="horizontal">
					// var horzSet = makeTag("fieldset", {
					// "data-role" : "controlgroup", //,
					// "data-type" : "horizontal",
					// }, field, true);
					fields += render.makeTag("div", {
						"class" : "ui-field-contain"
					}, field);

					counter++;
				});
			} else {
				var field = render.makeTag("label", {
					"for" : "newNodeNameId"
				}, "New Node Name") //
						+ render.makeTag("textarea", {
							"id" : "newNodeNameId"
						}, '');

				fields += render.makeTag("div", {
					"class" : "ui-field-contain"
				}, field);
			}
			util.setHtmlEnhanced($("#propertyEditFieldContainer"), fields);

			/*
			 * Allow adding of new properties as long as this is a saved node we
			 * are editing, because we don't want to start managing new
			 * properties on the client side. We need a genuine node already
			 * saved on the server before we allow any property editing to
			 * happen.
			 */
			util.setVisibility("#addPropertyButton", !_.editingUnsavedNode);
		},

		insertNode : function(uid) {
			_parentOfNewNode = meta64.currentNode;
			if (!_parentOfNewNode) {
				console.log("Unknown nodeId in insertNodeClick: " + uid);
				return;
			}

			var node = meta64.uidToNodeMap[uid];
			if (node) {
				_.nodeInsertTarget = node;
				_.startEditingNewNode();
			}
		},

		createSubNode : function(uid) {
			/*
			 * If no uid provided we deafult to creating a node under the
			 * currently viewed node (parent of current page)
			 */
			if (!uid) {
				_parentOfNewNode = meta64.currentNode;
			} else {
				_parentOfNewNode = meta64.uidToNodeMap[uid];
				if (!_parentOfNewNode) {
					console.log("Unknown nodeId in createSubNode: " + uid);
					return;
				}
			}

			/*
			 * this indicates we are NOT inserting inline. An inline insert
			 * would always have a target.
			 */
			_.nodeInsertTarget = null;
			_.startEditingNewNode();
		},

		deleteNode : function(uid) {
			util.areYouSure("Confirm Delete", "Delete the node?", "Yes, delete.", function() {
				var node = meta64.uidToNodeMap[uid];
				if (!node) {
					alert("Unknown nodeId in deleteNodeClick: " + uid);
				} else {
					util.json("deleteNode", {
						"nodeId" : node.id,
					}, _deleteNodeResponse);
				}
			});
		},

		insertBookWarAndPeace : function() {

			util.areYouSure("Confirm", "Insert book War and Peace?", "Yes, insert book.", function() {

				/* inserting under whatever node user has focused */
				var node = nav.getFocusedNode();

				if (!node) {
					alert("No node is selected.");
				} else {
					util.json("insertBook", {
						"nodeId" : node.id,
						"bookName" : "War and Peace"
					}, _insertBookResponse);
				}
			});
		}
	};

	console.log("Module ready: edit.js");
	return _;
}();
