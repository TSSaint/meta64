console.log("running module: EditNodeDlg.js");

declare var ace;

/*
 * Editor Dialog (Edits Nodes)
 *
 */
namespace m64 {
    export class EditNodeDlg extends DialogBase {

        contentFieldDomId: string;
        fieldIdToPropMap: any = {};
        propEntries: Array<PropEntry> = new Array<PropEntry>();
        editPropertyDlgInst: any;

        constructor() {
            super("EditNodeDlg");

            /*
             * Property fields are generated dynamically and this maps the DOM IDs of each field to the property object it
             * edits.
             */
            this.fieldIdToPropMap = {};
            this.propEntries = new Array<PropEntry>();
        }

        /*
         * Returns a string that is the HTML content of the dialog
         */
        build = (): string => {
            var header = this.makeHeader("Edit Node");

            var saveNodeButton = this.makeCloseButton("Save", "saveNodeButton", this.saveNode, this);
            var addPropertyButton = this.makeButton("Add Property", "addPropertyButton", this.addProperty, this);
            var addTagsPropertyButton = this.makeButton("Add Tags", "addTagsPropertyButton",
                this.addTagsProperty, this);
            var splitContentButton = this.makeButton("Split", "splitContentButton", this.splitContent, this);
            var cancelEditButton = this.makeCloseButton("Close", "cancelEditButton", this.cancelEdit, this);

            var buttonBar = render.centeredButtonBar(saveNodeButton + addPropertyButton + addTagsPropertyButton
                + splitContentButton + cancelEditButton, "buttons");

            var width = window.innerWidth * 0.6;
            var height = window.innerHeight * 0.4;
            var margin = window.innerWidth * .15;

            var internalMainContent = "";

            if (cnst.SHOW_PATH_IN_DLGS) {
                internalMainContent += render.tag("div", {
                    id: this.id("editNodePathDisplay"),
                    "class": "path-display-in-editor"
                });
            }

            internalMainContent += render.tag("div", {
                id: this.id("editNodeInstructions")
            }) + render.tag("div", {
                id: this.id("propertyEditFieldContainer"),
                // todo-0: create CSS class for this.
                style: "margin:"+margin+"px; padding-left: 0px; width:" + width + "px;height:" + height + "px;overflow:scroll;" // border:4px solid
                // lightGray;"
            }, "Loading...");

            return header + internalMainContent + buttonBar;
        }

        /*
         * Generates all the HTML edit fields and puts them into the DOM model of the property editor dialog box.
         *
         */
        populateEditNodePg = () => {
            /* display the node path at the top of the edit page */
            view.initEditPathDisplayById(this.id("editNodePathDisplay"));

            var fields = "";
            var counter = 0;

            /* clear this map to get rid of old properties */
            this.fieldIdToPropMap = {};
            this.propEntries = new Array<PropEntry>();

            /* editNode will be null if this is a new node being created */
            if (edit.editNode) {
                console.log("Editing existing node.");

                /* iterator function will have the wrong 'this' so we save the right one */
                var thiz = this;
                var editOrderedProps = props.getPropertiesInEditingOrder(edit.editNode.properties);

                var aceFields = [];

                // Iterate PropertyInfo.java objects
                /*
                 * Warning each iterator loop has its own 'this'
                 */
                $.each(editOrderedProps, function(index, prop) {

                    /*
                     * if property not allowed to display return to bypass this property/iteration
                     */
                    if (!render.allowPropertyToDisplay(prop.name)) {
                        console.log("Hiding property: " + prop.name);
                        return;
                    }

                    var fieldId = thiz.id("editNodeTextContent" + index);
                    console.log("Creating edit field " + fieldId + " for property " + prop.name);

                    var isMulti = prop.values && prop.values.length > 0;
                    var isReadOnlyProp = render.isReadOnlyProperty(prop.name);
                    var isBinaryProp = render.isBinaryProperty(prop.name);

                    let propEntry: PropEntry = new PropEntry(fieldId, prop, isMulti, isReadOnlyProp, isBinaryProp, null);

                    thiz.fieldIdToPropMap[fieldId] = propEntry;
                    thiz.propEntries.push(propEntry);

                    var buttonBar = "";
                    if (!isReadOnlyProp && !isBinaryProp) {
                        buttonBar = thiz.makePropertyEditButtonBar(prop, fieldId);
                    }

                    var field = buttonBar;

                    if (isMulti) {
                        field += thiz.makeMultiPropEditor(propEntry);
                    } else {
                        field += thiz.makeSinglePropEditor(propEntry, aceFields);
                    }

                    fields += render.tag("div", {
                        "class": ((!isReadOnlyProp && !isBinaryProp) || edit.showReadOnlyProperties ? "propertyEditListItem"
                            : "propertyEditListItemHidden")
                        // "style" : "display: "+ (!rdOnly || meta64.showReadOnlyProperties ? "inline" : "none")
                    }, field);
                });
            }
            /* Editing a new node */
            else {
                // todo-0: this entire block needs review now (redesign)
                console.log("Editing new node.");

                if (cnst.USE_ACE_EDITOR) {
                    var aceFieldId = this.id("newNodeNameId");

                    fields += render.tag("div", {
                        "id": aceFieldId,
                        "class": "ace-edit-panel",
                        "html": "true"
                    }, '', true);

                    aceFields.push({
                        id: aceFieldId,
                        val: ""
                    });
                } else {
                    var field = render.tag("paper-textarea", {
                        "id": this.id("newNodeNameId"),
                        "label": "New Node Name"
                    }, '', true);

                    // todo-0: I can remove this div now ?
                    fields += render.tag("div", {}, field);
                }
            }

            //I'm not quite ready to add this button yet.
            // var toggleReadonlyVisButton = render.tag("paper-button", {
            //     "raised": "raised",
            //     "onClick": "meta64.getObjectByGuid(" + this.guid + ").toggleShowReadOnly();" //
            // }, //
            //     (edit.showReadOnlyProperties ? "Hide Read-Only Properties" : "Show Read-Only Properties"));
            //
            // fields += toggleReadonlyVisButton;

            util.setHtml(this.id("propertyEditFieldContainer"), fields);

            if (cnst.USE_ACE_EDITOR) {
                for (var i = 0; i < aceFields.length; i++) {
                    var editor = ace.edit(aceFields[i].id);
                    editor.setValue(aceFields[i].val.unencodeHtml());
                    meta64.aceEditorsById[aceFields[i].id] = editor;
                }
            }

            var instr = edit.editingUnsavedNode ? //
                "You may leave this field blank and a unique ID will be assigned. You only need to provide a name if you want this node to have a more meaningful URL."
                : //
                "";

            $("#" + this.id("editNodeInstructions")).html(instr);

            /*
             * Allow adding of new properties as long as this is a saved node we are editing, because we don't want to start
             * managing new properties on the client side. We need a genuine node already saved on the server before we allow
             * any property editing to happen.
             */
            util.setVisibility("#" + this.id("addPropertyButton"), !edit.editingUnsavedNode);

            var tagsPropExists = props.getNodePropertyVal("tags", edit.editNode) != null;
            // console.log("hasTagsProp: " + tagsProp);
            util.setVisibility("#" + this.id("addTagsPropertyButton"), !tagsPropExists);
        }

        toggleShowReadOnly = (): void => {
            // alert("not yet implemented.");
            // see saveExistingNode for how to iterate all properties, although I wonder why I didn't just use a map/set of
            // properties elements
            // instead so I don't need to parse any DOM or domIds inorder to iterate over the list of them????
        }

        addProperty = (): void => {
            this.editPropertyDlgInst = new EditPropertyDlg(this);
            this.editPropertyDlgInst.open();
        }

        addTagsProperty = (): void => {
            if (props.getNodePropertyVal(edit.editNode, "tags")) {
                return;
            }

            var postData = {
                nodeId: edit.editNode.id,
                propertyName: "tags",
                propertyValue: ""
            };
            util.json<json.SavePropertyRequest, json.SavePropertyResponse>("saveProperty", postData, this.addTagsPropertyResponse, this);
        }

        addTagsPropertyResponse = (res: json.SavePropertyResponse): void => {
            if (util.checkSuccess("Add Tags Property", res)) {
                this.savePropertyResponse(res);
            }
        }

        savePropertyResponse = (res: any): void => {
            util.checkSuccess("Save properties", res);

            edit.editNode.properties.push(res.propertySaved);
            meta64.treeDirty = true;

            if (this.domId != "EditNodeDlg") {
                console.log("error: incorrect object for EditNodeDlg");
            }
            this.populateEditNodePg();
        }

        /*
         * Note: fieldId parameter is already dialog-specific and doesn't need id() wrapper function
         */
        makePropertyEditButtonBar = (prop: any, fieldId: string): string => {
            var buttonBar = "";

            var clearButton = render.tag("paper-button", {
                "raised": "raised",
                "onClick": "m64.meta64.getObjectByGuid(" + this.guid + ").clearProperty('" + fieldId + "');" //
            }, //
                "Clear");

            var addMultiButton = "";
            var deleteButton = "";

            if (prop.name !== jcrCnst.CONTENT) {
                /*
                 * For now we just go with the design where the actual content property cannot be deleted. User can leave
                 * content blank but not delete it.
                 */
                deleteButton = render.tag("paper-button", {
                    "raised": "raised",
                    "onClick": "m64.meta64.getObjectByGuid(" + this.guid + ").deleteProperty('" + prop.name + "');" //
                }, //
                    "Del");

                /*
                 * I don't think it really makes sense to allow a jcr:content property to be multivalued. I may be wrong but
                 * this is my current assumption
                 */
                //todo-0: There's a bug in editing multiple-valued properties, and so i'm just turning it off for now
                //while i complete testing of the rest of the app.
                //
                // addMultiButton = render.tag("paper-button", {
                //     "raised": "raised",
                //     "onClick": "meta64.getObjectByGuid(" + this.guid + ").addSubProperty('" + fieldId + "');" //
                // }, //
                //     "Add Multi");
            }

            var allButtons = addMultiButton + clearButton + deleteButton;
            if (allButtons.length > 0) {
                buttonBar = render.makeHorizontalFieldSet(allButtons, "property-edit-button-bar");
            } else {
                buttonBar = "";
            }

            return buttonBar;
        }

        addSubProperty = (fieldId: string): void => {
            var prop = this.fieldIdToPropMap[fieldId].property;

            var isMulti = util.isObject(prop.values);

            /* convert to multi-type if we need to */
            if (!isMulti) {
                prop.values = [];
                prop.values.push(prop.value);
                prop.value = null;
            }

            /*
             * now add new empty property and populate it onto the screen
             *
             * TODO-3: for performance we could do something simpler than 'populateEditNodePg' here, but for now we just
             * rerendering the entire edit page.
             */
            prop.values.push("");

            this.populateEditNodePg();
        }

        /*
         * Deletes the property of the specified name on the node being edited, but first gets confirmation from user
         */
        deleteProperty = (propName: string) => {
            var thiz = this;
            (new ConfirmDlg("Confirm Delete", "Delete the Property: " + propName, "Yes, delete.", function() {
                thiz.deletePropertyImmediate(propName);
            })).open();
        }

        deletePropertyImmediate = (propName: string) => {

            var thiz = this;
            util.json<json.DeletePropertyRequest, json.DeletePropertyResponse>("deleteProperty", {
                "nodeId": edit.editNode.id,
                "propName": propName
            }, function(res: json.DeletePropertyResponse) {
                thiz.deletePropertyResponse(res, propName);
            });
        }

        deletePropertyResponse = (res: any, propertyToDelete: any) => {

            if (util.checkSuccess("Delete property", res)) {

                /*
                 * remove deleted property from client side storage, so we can re-render screen without making another call to
                 * server
                 */
                props.deletePropertyFromLocalData(propertyToDelete);

                /* now just re-render screen from local variables */
                meta64.treeDirty = true;

                this.populateEditNodePg();
            }
        }

        clearProperty = (fieldId: string): void => {
            if (!cnst.USE_ACE_EDITOR) {
                util.setInputVal(this.id(fieldId), "");
            } else {
                var editor = meta64.aceEditorsById[this.id(fieldId)];
                if (editor) {
                    editor.setValue("");
                }
            }

            /* scan for all multi-value property fields and clear them */
            var counter = 0;
            while (counter < 1000) {
                if (!cnst.USE_ACE_EDITOR) {
                    if (!util.setInputVal(this.id(fieldId + "_subProp" + counter), "")) {
                        break;
                    }
                } else {
                    var editor = meta64.aceEditorsById[this.id(fieldId + "_subProp" + counter)];
                    if (editor) {
                        editor.setValue("");
                    } else {
                        break;
                    }
                }
                counter++;
            }
        }

        /*
         * for now just let server side choke on invalid things. It has enough security and validation to at least protect
         * itself from any kind of damage.
         */
        saveNode = (): void => {
            /*
             * If editing an unsaved node it's time to run the insertNode, or createSubNode, which actually saves onto the
             * server, and will initiate further editing like for properties, etc.
             */
            if (edit.editingUnsavedNode) {
                console.log("saveNewNode.");

                // todo-0: need to make this compatible with Ace Editor.
                this.saveNewNode();
            }
            /*
             * Else we are editing a saved node, which is already saved on server.
             */
            else {
                console.log("saveExistingNode.");
                this.saveExistingNode();
            }
        }

        saveNewNode = (newNodeName?: string): void => {
            if (!newNodeName) {
                newNodeName = util.getInputVal(this.id("newNodeNameId"));
            }

            /*
             * If we didn't create the node we are inserting under, and neither did "admin", then we need to send notification
             * email upon saving this new node.
             */
            if (meta64.userName != edit.parentOfNewNode.createdBy && //
                edit.parentOfNewNode.createdBy != "admin") {
                edit.sendNotificationPendingSave = true;
            }

            meta64.treeDirty = true;
            if (edit.nodeInsertTarget) {
                util.json<json.InsertNodeRequest, json.InsertNodeResponse>("insertNode", {
                    "parentId": edit.parentOfNewNode.id,
                    "targetName": edit.nodeInsertTarget.name,
                    "newNodeName": newNodeName
                }, edit.insertNodeResponse, edit);
            } else {
                util.json<json.CreateSubNodeRequest, json.CreateSubNodeResponse>("createSubNode", {
                    "nodeId": edit.parentOfNewNode.id,
                    "newNodeName": newNodeName
                }, edit.createSubNodeResponse, edit);
            }
        }

        saveExistingNode = (): void => {
            console.log("saveExistingNode");

            /* holds list of properties to send to server. Each one having name+value properties */
            var propertiesList = [];
            var thiz = this;

            $.each(this.propEntries, function(index: number, prop: any) {

                console.log("--------------- Getting prop idx: " + index);

                /* Ignore this property if it's one that cannot be edited as text */
                if (prop.readOnly || prop.binary)
                    return;

                if (!prop.multi) {
                    console.log("Saving non-multi property field: " + JSON.stringify(prop));

                    var propVal;

                    if (cnst.USE_ACE_EDITOR) {
                        var editor = meta64.aceEditorsById[prop.id];
                        if (!editor)
                            throw "Unable to find Ace Editor for ID: " + prop.id;
                        propVal = editor.getValue();
                    } else {
                        propVal = util.getTextAreaValById(prop.id);
                    }

                    if (propVal !== prop.value) {
                        console.log("Prop changed: propName=" + prop.property.name + " propVal=" + propVal);
                        propertiesList.push({
                            "name": prop.property.name,
                            "value": propVal
                        });
                    } else {
                        console.log("Prop didn't change: " + prop.id);
                    }
                }
                /* Else this is a MULTI property */
                else {
                    console.log("Saving multi property field: " + JSON.stringify(prop));

                    var propVals = [];

                    $.each(prop.subProps, function(index, subProp) {

                        console.log("subProp[" + index + "]: " + JSON.stringify(subProp));

                        var propVal;
                        if (cnst.USE_ACE_EDITOR) {
                            var editor = meta64.aceEditorsById[subProp.id];
                            if (!editor)
                                throw "Unable to find Ace Editor for subProp ID: " + subProp.id;
                            propVal = editor.getValue();
                            // alert("Setting[" + propVal + "]");
                        } else {
                            propVal = util.getTextAreaValById(subProp.id);
                        }

                        console.log("    subProp[" + index + "] of " + prop.name + " val=" + propVal);
                        propVals.push(propVal);
                    });

                    propertiesList.push({
                        "name": prop.name,
                        "values": propVals
                    });
                }

            });// end iterator

            /* if anything changed, save to server */
            if (propertiesList.length > 0) {
                var postData = {
                    nodeId: edit.editNode.id,
                    properties: propertiesList,
                    sendNotification: edit.sendNotificationPendingSave
                };
                console.log("calling saveNode(). PostData=" + util.toJson(postData));
                util.json<json.SaveNodeRequest, json.SaveNodeResponse>("saveNode", postData, edit.saveNodeResponse, null, {
                    savedId: edit.editNode.id
                });
                edit.sendNotificationPendingSave = false;
            } else {
                console.log("nothing changed. Nothing to save.");
            }
        }

        makeMultiPropEditor = (propEntry: PropEntry): string => {
            console.log("Making Multi Editor: Property multi-type: name=" + propEntry.property.name + " count="
                + propEntry.property.values.length);
            var fields = "";

            propEntry.subProps = [];

            var propList = propEntry.property.values;
            if (!propList || propList.length == 0) {
                propList = [];
                propList.push("");
            }

            for (var i = 0; i < propList.length; i++) {
                console.log("prop multi-val[" + i + "]=" + propList[i]);
                var id = this.id(propEntry.id + "_subProp" + i);

                var propVal = propEntry.binary ? "[binary]" : propList[i];
                var propValStr = propVal || '';
                propValStr = propVal.escapeForAttrib();
                var label = (i == 0 ? propEntry.property.name : "*") + "." + i;

                console.log("Creating textarea with id=" + id);

                let subProp: SubProp = new SubProp(id, propVal);
                propEntry.subProps.push(subProp);

                if (propEntry.binary || propEntry.readOnly) {
                    fields += render.tag("paper-textarea", {
                        "id": id,
                        "readonly": "readonly",
                        "disabled": "disabled",
                        "label": label,
                        "value": propValStr
                    }, '', true);
                } else {
                    fields += render.tag("paper-textarea", {
                        "id": id,
                        "label": label,
                        "value": propValStr
                    }, '', true);
                }
            }
            return fields;
        }

        makeSinglePropEditor = (propEntry: PropEntry, aceFields: any): string => {
            console.log("Property single-type: " + propEntry.property.name);

            var field = "";

            var propVal = propEntry.binary ? "[binary]" : propEntry.property.value;
            var label = render.sanitizePropertyName(propEntry.property.name);
            var propValStr = propVal ? propVal : '';
            propValStr = propValStr.escapeForAttrib();
            console.log("making single prop editor: prop[" + propEntry.property.name + "] val[" + propEntry.property.value
                + "] fieldId=" + propEntry.id);

            if (propEntry.readOnly || propEntry.binary) {
                field += render.tag("paper-textarea", {
                    "id": propEntry.id,
                    "readonly": "readonly",
                    "disabled": "disabled",
                    "label": label,
                    "value": propValStr
                }, "", true);
            } else {
                if (propEntry.property.name == jcrCnst.CONTENT) {
                    this.contentFieldDomId = propEntry.id;
                }
                if (!cnst.USE_ACE_EDITOR) {
                    field += render.tag("paper-textarea", {
                        "id": propEntry.id,
                        "label": label,
                        "value": propValStr
                    }, '', true);
                } else {
                    field += render.tag("div", {
                        "id": propEntry.id,
                        "class": "ace-edit-panel",
                        "html": "true"
                    }, '', true);

                    aceFields.push({
                        id: propEntry.id,
                        val: propValStr
                    });
                }
            }
            return field;
        }

        splitContent = (): void => {
            let nodeBelow: json.NodeInfo = edit.getNodeBelow(edit.editNode);
            util.json<json.SplitNodeRequest, json.SplitNodeResponse>("splitNode", {
                "nodeId": edit.editNode.id,
                "nodeBelowId": (nodeBelow == null ? null : nodeBelow.id),
                "delimiter": null
            }, this.splitContentResponse);
        }

        splitContentResponse = (res: json.SplitNodeResponse): void => {
            if (util.checkSuccess("Split content", res)) {
                this.cancel();
                view.refreshTree(null, false);
                meta64.selectTab("mainTabName");
                view.scrollToSelectedNode();
            }
        }

        cancelEdit = (): void => {
            this.cancel();
            if (meta64.treeDirty) {
                meta64.goToMainPage(true);
            } else {
                meta64.selectTab("mainTabName");
                view.scrollToSelectedNode();
            }
        }

        init = (): void => {
            console.log("EditNodeDlg.init");
            this.populateEditNodePg();
            if (this.contentFieldDomId) {
                util.delayedFocus("#" + this.contentFieldDomId);
            }
        }
    }
}
