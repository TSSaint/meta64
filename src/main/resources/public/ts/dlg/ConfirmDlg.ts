console.log("running module: ConfirmDlg.js");

class ConfirmDlg extends DialogBase {
    
    constructor(private title: string, private message: string, private buttonText: string, private callback: Function) {
        super("ConfirmDlg");
    }

    /*
     * Returns a string that is the HTML content of the dialog
     */
    build(): string {
        var content: string = this.makeHeader("", "ConfirmDlgTitle") + this.makeMessageArea("", "ConfirmDlgMessage");

        var buttons = this.makeCloseButton("Yes", "ConfirmDlgYesButton", this.callback)
            + this.makeCloseButton("No", "ConfirmDlgNoButton");
        content += render.centeredButtonBar(buttons);

        return content;
    }

    init(): void {
        this.setHtml(this.title, "ConfirmDlgTitle");
        this.setHtml(this.message, "ConfirmDlgMessage");
        this.setHtml(this.buttonText, "ConfirmDlgYesButton");
    }
}
