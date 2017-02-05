console.log("ChangePasswordDlgImpl.ts");

import { DialogBaseImpl } from "./DialogBaseImpl";
import { ChangePasswordDlg } from "./ChangePasswordDlg";
import { render } from "./Render";
import {Factory} from "./Factory";
import {MessageDlg} from "./MessageDlg";
import { util } from "./Util";
import * as I from "./Interfaces";

export default class ChangePasswordDlgImpl extends DialogBaseImpl implements ChangePasswordDlg {

    pwd: string;
    private passCode: string;

    constructor(args:Object) {
        super("ChangePasswordDlg");
        this.passCode = (<any>args).passCode;
    }

    /*
     * Returns a string that is the HTML content of the dialog.
     *
     * If the user is doing a "Reset Password" we will have a non-null passCode here, and we simply send this to the server
     * where it will validate the passCode, and if it's valid use it to perform the correct password change on the correct
     * user.
     */
    build = (): string => {

        var header = this.makeHeader(this.passCode ? "Password Reset" : "Change Password");

        var message = render.tag("p", {

        }, "Enter your new password below...");

        var formControls = this.makePasswordField("New Password", "changePassword1");

        var changePasswordButton = this.makeCloseButton("Change Password", "changePasswordActionButton",
            this.changePassword, this);
        var backButton = this.makeCloseButton("Close", "cancelChangePasswordButton");

        var buttonBar = render.centeredButtonBar(changePasswordButton + backButton);

        return header + message + formControls + buttonBar;
    }

    changePassword = (): void => {
        this.pwd = this.getInputVal("changePassword1").trim();

        if (this.pwd && this.pwd.length >= 4) {
            util.json<I.ChangePasswordRequest, I.ChangePasswordResponse>("changePassword", {
                "newPassword": this.pwd,
                "passCode": this.passCode
            }, this.changePasswordResponse, this);
        } else {
            util.showMessage("Invalid password(s).");
        }
    }

    changePasswordResponse = (res: I.ChangePasswordResponse) => {
        if (util.checkSuccess("Change password", res)) {

            var msg = "Password changed successfully.";

            if (this.passCode) {
                msg += "<p>You may now login as <b>" + res.user
                    + "</b> with your new password.";
            }

            let thiz = this;
            Factory.create("MessageDlg", (dlg: MessageDlg) => {
                dlg.open();
            }
                , {
                    "title": "Password Change", callback: () => {
                        if (thiz.passCode) {
                            //this login call DOES work, but the reason we don't do this is because the URL still has the passCode on it and we
                            //want to direct the user to a url without that.
                            //user.login(null, res.user, thiz.pwd);

                            window.location.href = window.location.origin;
                        }
                    }
                });
        }
    }

    init = (): void => {
        this.focus("changePassword1");
    }
}
