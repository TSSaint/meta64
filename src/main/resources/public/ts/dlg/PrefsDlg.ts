
console.log("running module: PrefsDlg.js");

class PrefsDlg extends DialogBase {
    constructor() {
        super("PrefsDlg");
    }

    /*
     * Returns a string that is the HTML content of the dialog
     */
    build = (): string => {
        var header = this.makeHeader("Account Peferences");

        var radioButtons = this.makeRadioButton("Simple", "editModeSimple") + //
            this.makeRadioButton("Advanced", "editModeAdvanced");

        var radioButtonGroup = render.tag("paper-radio-group", {
            "id": this.id("simpleModeRadioGroup"),
            "selected": this.id("editModeSimple")
        }, radioButtons);

        var formControls = radioButtonGroup;

        var legend = "<legend>Edit Mode:</legend>";
        var radioBar = render.makeHorzControlGroup(legend + formControls);

        var saveButton = this.makeCloseButton("Save", "savePreferencesButton", this.savePreferences, this);
        var backButton = this.makeCloseButton("Cancel", "cancelPreferencesDlgButton");

        var buttonBar = render.centeredButtonBar(saveButton + backButton);

        return header + radioBar + buttonBar;
    }

    savePreferences = (): void => {
        var polyElm = util.polyElm(this.id("simpleModeRadioGroup"));
        meta64.editModeOption = polyElm.node.selected == this.id("editModeSimple") ? meta64.MODE_SIMPLE
            : meta64.MODE_ADVANCED;
        util.json("saveUserPreferences", {
            "userPreferences": {
                "advancedMode": meta64.editModeOption === meta64.MODE_ADVANCED
            }
        }, this.savePreferencesResponse, this);
    }

    savePreferencesResponse = (res: any): void => {
        if (util.checkSuccess("Saving Preferences", res)) {
            meta64.selectTab("mainTabName");
            meta64.refresh();
            // todo-2: try and maintain scroll position ? this is going to be async, so watch out.
            // view.scrollToSelectedNode();
        }
    }

    init = (): void => {
        var polyElm = util.polyElm(this.id("simpleModeRadioGroup"));
        polyElm.node.select(meta64.editModeOption == meta64.MODE_SIMPLE ? this.id("editModeSimple") : this
            .id("editModeAdvanced"));
        Polymer.dom.flush();
    }
}
