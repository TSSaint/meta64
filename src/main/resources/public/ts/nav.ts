
console.log("running module: nav.js");

var nav = function() {
	var _UID_ROWID_SUFFIX = "_row";

	var _ = {
		openMainMenuHelp : function() {
			window.open(window.location.origin + "?id=/meta64/public/help", "_blank");
		},

		displayingHome : function() {
			if (meta64.isAnonUser) {
				return meta64.currentNodeId === meta64.anonUserLandingPageNode;
			} else {
				return meta64.currentNodeId === meta64.homeNodeId;
			}
		},

		parentVisibleToUser : function() {
			return !_.displayingHome();
		},

		upLevelResponse : function(res, id) {
			if (!res || !res.node) {
				(new MessageDlg("No data is visible to you above this node.")).open();
			} else {
				render.renderPageFromData(res);
				meta64.highlightRowById(id, true);
				meta64.refreshAllGuiEnablement();
			}
		},

		navUpLevel : function() {

			if (!_.parentVisibleToUser()) {
				// Already at root. Can't go up.
				return;
			}

			var ironRes = util.json("renderNode", {
				"nodeId" : meta64.currentNodeId,
				"upLevel" : 1
			});

			ironRes.completes.then(function() {
				_.upLevelResponse(ironRes.response, meta64.currentNodeId);
			});
		},

		/*
		 * turn of row selection DOM element of whatever row is currently selected
		 */
		getSelectedDomElement : function() {

			var currentSelNode = meta64.getHighlightedNode();
			if (currentSelNode) {

				/* get node by node identifier */
				var node = meta64.uidToNodeMap[currentSelNode.uid];

				if (node) {
					console.log("found highlighted node.id=" + node.id);

					/* now make CSS id from node */
					var nodeId = node.uid + _UID_ROWID_SUFFIX;
					// console.log("looking up using element id: "+nodeId);

					return util.domElm(nodeId);
				}
			}

			return null;
		},

		/*
		 * turn of row selection DOM element of whatever row is currently selected
		 */
		getSelectedPolyElement : function() {
			try {
				var currentSelNode = meta64.getHighlightedNode();
				if (currentSelNode) {

					/* get node by node identifier */
					var node = meta64.uidToNodeMap[currentSelNode.uid];

					if (node) {
						console.log("found highlighted node.id=" + node.id);

						/* now make CSS id from node */
						var nodeId = node.uid + _UID_ROWID_SUFFIX;
						console.log("looking up using element id: " + nodeId);

						return util.polyElm(nodeId);
					}
				} else {
					console.log("no node highlighted");
				}
			} catch (e) {
				console.log("getSelectedPolyElement failed.");
			}
			return null;
		},

		clickOnNodeRow : function(rowElm, uid) {

			var node = meta64.uidToNodeMap[uid];
			if (!node) {
				console.log("clickOnNodeRow recieved uid that doesn't map to any node. uid=" + uid);
				return;
			}

			/*
			 * sets which node is selected on this page (i.e. parent node of this page being the 'key')
			 */
			meta64.highlightNode(node, false);

			if (meta64.editMode) {

				/*
				 * if node.owner is currently null, that means we have not retrieve the owner from the server yet, but
				 * if non-null it's already displaying and we do nothing.
				 */
				if (!node.owner) {
					console.log("calling updateNodeInfo");
					meta64.updateNodeInfo(node);
				}
			}
			meta64.refreshAllGuiEnablement();
		},

		openNode : function(uid) {

			var node = meta64.uidToNodeMap[uid];

			meta64.highlightNode(node, true);

			if (!node) {
				(new MessageDlg("Unknown nodeId in openNode: " + uid)).open();
			} else {
				view.refreshTree(node.id, false);
			}
		},

		/*
		 * unfortunately we have to rely on onClick, because of the fact that events to checkboxes don't appear to work
		 * in Polmer at all, and since onClick runs BEFORE the state change is completed, that is the reason for the
		 * silly looking async timer here.
		 */
		toggleNodeSel : function(uid) {
			var toggleButton = util.polyElm(uid + "_sel");
			setTimeout(function() {
				if (toggleButton.node.checked) {
					meta64.selectedNodes[uid] = true;
				} else {
					delete meta64.selectedNodes[uid];
				}

				view.updateStatusBar();
				meta64.refreshAllGuiEnablement();
			}, 500);
		},

		navHomeResponse : function(res) {
			meta64.clearSelectedNodes();
			render.renderPageFromData(res);
			view.scrollToTop();
			meta64.refreshAllGuiEnablement();
		},

		navHome : function() {
			if (meta64.isAnonUser) {
				meta64.loadAnonPageHome(true);
				// window.location.href = window.location.origin;
			} else {
				util.json("renderNode", {
					"nodeId" : meta64.homeNodeId
				}, _.navHomeResponse);
			}
		},

		navPublicHome : function() {
			meta64.loadAnonPageHome(true);
		},

		toggleMainMenu : function() {
			//var paperDrawerPanel = util.polyElm("paperDrawerPanel");

			/*
			 * this togglePanel function does absolutely nothing, and I think this is probably a bug on the google
			 * polymer code, because it should always work.
			 */
			//paperDrawerPanel.node.togglePanel();
		}
	};

	console.log("Module ready: nav.js");
	return _;
}();
