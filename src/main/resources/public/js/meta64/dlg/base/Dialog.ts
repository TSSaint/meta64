console.log("running module: Dialog.js");

/*
 * Base class for all dialog boxes.
 *
 * todo: when refactoring all dialogs to this new base-class design I'm always
 * creating a new dialog each time, so the next optimization will be to make
 * certain dialogs (indeed most of them) be able to behave as singletons once
 * they have been constructed where they merely have to be reshown and
 * repopulated to reopen one of them, and closing any of them is merely done by
 * making them invisible.
 */
var Dialog = function() {
    this.data = {};

	/*
	 * We register 'this' so we can do meta64.getObjectByGuid in onClick methods
	 * on the dialog and be able to have 'this'available to the functions.
	 */
    meta64.registerDataObject(this);
    meta64.registerDataObject(this.data);
}

Dialog.prototype.constructor = Dialog;
var Dialog_ = Dialog.prototype;

Dialog_.open = function() {

	/*
	 * get container where all dialogs are created (true polymer dialogs)
	 */
    var modalsContainer = util.polyElm("modalsContainer");

    /* suffix domId for this instance/guid */
    var id = this.id(this.domId);

	/*
	 * TODO. IMPORTANT: need to put code in to remove this dialog from the dom
	 * once it's closed, AND that same code should delete the guid's object in
	 * map in this module
	 */
    var node = document.createElement("paper-dialog");

    //NOTE: This works, but is an example of what NOT to do actually. Instead always
    //set these properties on the 'polyElm.node' below.
    //node.setAttribute("with-backdrop", "with-backdrop");

    node.setAttribute("id", id);
    modalsContainer.node.appendChild(node);

    // todo-3: put in CSS now
    node.style.border = "3px solid gray";

    Polymer.dom.flush(); // <---- is this needed ? todo-3
    Polymer.updateStyles();

    var content = this.build();
    util.setHtmlEnhanced(id, content);
    this.built = true;

    if (this.init) {
        this.init();
    }
    console.log("Showing dialog: " + id);

    /* now open and display polymer dialog we just created */
    var polyElm = util.polyElm(id);
    polyElm.node.modal = true;
    polyElm.node.refit();
    polyElm.node.constrain();
    polyElm.node.center();
    polyElm.node.open();
}

/* todo: need to cleanup the registered IDs that are in maps for this dialog */
Dialog_.cancel = function() {
    var polyElm = util.polyElm(this.id(this.domId));
    polyElm.node.cancel();
}

/*
 * Helper method to get the true id that is specific to this dialog (i.e. guid
 * suffix appended)
 */
Dialog_.id = function(id) {
    if (id == null)
        return null;

    /* if dialog already suffixed */
    if (id.contains("_dlgId")) {
        return id;
    }
    return id + "_dlgId" + this.data.guid;
}

Dialog_.makePasswordField = function(text, id) {
    return render.makePasswordField(text, this.id(id));
}

Dialog_.makeEditField = function(fieldName, id) {
    id = this.id(id);
    return render.tag("paper-input", {
        "name": id,
        "label": fieldName,
        "id": id
    }, "", true);
}

Dialog_.makeMessageArea = function(message, id) {
    var attrs = {
        "class": "dialog-message"
    };
    if (id) {
        attrs["id"] = this.id(id);
    }
    return render.tag("p", attrs, message);
}

// todo: there's a makeButton (and other similar methods) that don't have the
// encodeCallback capability yet
Dialog_.makeButton = function(text, id, callback, ctx) {
    var attribs = {
        "raised": "raised",
        "id": this.id(id)
    };

    if (callback != undefined) {
        attribs["onClick"] = meta64.encodeOnClick(callback, ctx);
    }

    return render.tag("paper-button", attribs, text, true);
}

Dialog_.makeCloseButton = function(text, id, callback, ctx) {

    var attribs = {
        "raised": "raised",
        // warning: this dialog-confirm is required (logic fails without)
        "dialog-confirm": "dialog-confirm",
        "id": this.id(id)
    };

    if (callback != undefined) {
        attribs["onClick"] = meta64.encodeOnClick(callback, ctx);
    }

    return render.tag("paper-button", attribs, text, true);
}

Dialog_.bindEnterKey = function(id, callback) {
    util.bindEnterKey(this.id(id), callback);
}

Dialog_.setInputVal = function(id, val) {
    if (!val) {
        val = "";
    }
    util.setInputVal(this.id(id), val);
}

Dialog_.getInputVal = function(id) {
    return util.getInputVal(this.id(id)).trim();
}

Dialog_.setHtml = function(text, id) {
    util.setHtml(this.id(id), text);
}

Dialog_.makeRadioButton = function(label, id) {
    id = this.id(id);
    return render.tag("paper-radio-button", {
        "id": id,
        "name": id
    }, label);
}

Dialog_.makeHeader = function(text, id, centered) {
    var attrs = {
        "class": "dialog-header " + (centered ? "horizontal center-justified layout" : "")
    };

    //add id if one was provided
    if (id) {
        attrs["id"] = this.id(id);
    }

    return render.tag("h2", attrs, text);
}

Dialog_.focus = function(id) {
    if (!id.startsWith("#")) {
        id = "#" + id;
    }
    id = this.id(id);
    setTimeout(function() {
        $(id).focus();
    }, 1000);
}

//# sourceURL=Dialog.js
