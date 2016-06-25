console.log("running module: PrefsDlg.js");
var PrefsDlg = function () {
    Dialog.call(this);
    this.domId = "PrefsDlg";
};
var PrefsDlg_ = util.inherit(Dialog, PrefsDlg);
PrefsDlg_.build = function () {
    var header = this.makeHeader("Account Peferences");
    var radioButtons = this.makeRadioButton("Simple", "editModeSimple") +
        this.makeRadioButton("Advanced", "editModeAdvanced");
    var radioButtonGroup = render.tag("paper-radio-group", {
        "id": this.id("simpleModeRadioGroup"),
        "selected": this.id("editModeSimple")
    }, radioButtons);
    var formControls = radioButtonGroup;
    var legend = "<legend>Edit Mode:</legend>";
    var radioBar = render.makeHorzControlGroup(legend + formControls);
    var saveButton = this.makeCloseButton("Save", "savePreferencesButton", PrefsDlg_.savePreferences, this);
    var backButton = this.makeCloseButton("Cancel", "cancelPreferencesDlgButton");
    var buttonBar = render.centeredButtonBar(saveButton + backButton);
    return header + radioBar + buttonBar;
};
PrefsDlg_.savePreferences = function () {
    var polyElm = util.polyElm(this.id("simpleModeRadioGroup"));
    meta64.editModeOption = polyElm.node.selected == this.id("editModeSimple") ? meta64.MODE_SIMPLE
        : meta64.MODE_ADVANCED;
    util.json("saveUserPreferences", {
        "userPreferences": {
            "advancedMode": meta64.editModeOption === meta64.MODE_ADVANCED
        }
    }, PrefsDlg_.savePreferencesResponse, this);
};
PrefsDlg_.savePreferencesResponse = function (res) {
    if (util.checkSuccess("Saving Preferences", res)) {
        meta64.selectTab("mainTabName");
        meta64.refresh();
    }
};
PrefsDlg_.init = function () {
    var polyElm = util.polyElm(this.id("simpleModeRadioGroup"));
    polyElm.node.select(meta64.editModeOption == meta64.MODE_SIMPLE ? this.id("editModeSimple") : this
        .id("editModeAdvanced"));
    Polymer.dom.flush();
};
//# sourceMappingURL=PrefsDlg.js.map