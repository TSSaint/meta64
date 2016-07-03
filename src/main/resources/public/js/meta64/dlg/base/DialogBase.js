console.log("running module: DialogBase.js");
var DialogBase = (function () {
    function DialogBase(domId) {
        this.domId = domId;
        this.data = {};
        meta64.registerDataObject(this);
        meta64.registerDataObject(this.data);
    }
    DialogBase.prototype.init = function () {
    };
    DialogBase.prototype.open = function () {
        var modalsContainer = util.polyElm("modalsContainer");
        var id = this.id(this.domId);
        var node = document.createElement("paper-dialog");
        node.setAttribute("id", id);
        modalsContainer.node.appendChild(node);
        node.style.border = "3px solid gray";
        Polymer.dom.flush();
        Polymer.updateStyles();
        var content = this.build();
        util.setHtmlEnhanced(id, content);
        this.built = true;
        if (this.init) {
            this.init();
        }
        console.log("Showing dialog: " + id);
        var polyElm = util.polyElm(id);
        polyElm.node.refit();
        polyElm.node.constrain();
        polyElm.node.center();
        polyElm.node.open();
    };
    DialogBase.prototype.cancel = function () {
        var polyElm = util.polyElm(this.id(this.domId));
        polyElm.node.cancel();
    };
    DialogBase.prototype.id = function (id) {
        if (id == null)
            return null;
        if (id.contains("_dlgId")) {
            return id;
        }
        return id + "_dlgId" + this.data.guid;
    };
    DialogBase.prototype.makePasswordField = function (text, id) {
        return render.makePasswordField(text, this.id(id));
    };
    DialogBase.prototype.makeEditField = function (fieldName, id) {
        id = this.id(id);
        return render.tag("paper-input", {
            "name": id,
            "label": fieldName,
            "id": id
        }, "", true);
    };
    DialogBase.prototype.makeMessageArea = function (message, id) {
        var attrs = {
            "class": "dialog-message"
        };
        if (id) {
            attrs["id"] = this.id(id);
        }
        return render.tag("p", attrs, message);
    };
    DialogBase.prototype.makeButton = function (text, id, callback, ctx) {
        var attribs = {
            "raised": "raised",
            "id": this.id(id)
        };
        if (callback != undefined) {
            attribs["onClick"] = meta64.encodeOnClick(callback, ctx);
        }
        return render.tag("paper-button", attribs, text, true);
    };
    DialogBase.prototype.makeCloseButton = function (text, id, callback, ctx) {
        var attribs = {
            "raised": "raised",
            "dialog-confirm": "dialog-confirm",
            "id": this.id(id)
        };
        if (callback != undefined) {
            attribs["onClick"] = meta64.encodeOnClick(callback, ctx);
        }
        return render.tag("paper-button", attribs, text, true);
    };
    DialogBase.prototype.bindEnterKey = function (id, callback) {
        util.bindEnterKey(this.id(id), callback);
    };
    DialogBase.prototype.setInputVal = function (id, val) {
        if (!val) {
            val = "";
        }
        util.setInputVal(this.id(id), val);
    };
    DialogBase.prototype.getInputVal = function (id) {
        return util.getInputVal(this.id(id)).trim();
    };
    DialogBase.prototype.setHtml = function (text, id) {
        util.setHtml(this.id(id), text);
    };
    DialogBase.prototype.makeRadioButton = function (label, id) {
        id = this.id(id);
        return render.tag("paper-radio-button", {
            "id": id,
            "name": id
        }, label);
    };
    DialogBase.prototype.makeHeader = function (text, id, centered) {
        var attrs = {
            "class": "dialog-header " + (centered ? "horizontal center-justified layout" : "")
        };
        if (id) {
            attrs["id"] = this.id(id);
        }
        return render.tag("h2", attrs, text);
    };
    DialogBase.prototype.focus = function (id) {
        if (!id.startsWith("#")) {
            id = "#" + id;
        }
        id = this.id(id);
        setTimeout(function () {
            $(id).focus();
        }, 1000);
    };
    return DialogBase;
}());
//# sourceMappingURL=DialogBase.js.map