console.log("LoginDlg.ts");

import { DialogBaseImpl } from "./DialogBaseImpl";
import { LoginDlg } from "./LoginDlg";
import { ConfirmDlg } from "./ConfirmDlg";
import { ResetPasswordDlg } from "./ResetPasswordDlg";
import { render } from "./Render";
import { user } from "./User";
import { cnst } from "./Constants";
import { util } from "./Util";
import { Factory } from "./Factory";
import { tag } from "./Tag";

/*
NOTE: This dialog is not yet converted to new Widget Architecture (see ChangePasswordDlgImpl.ts for a working example of the
new architecture)
*/
export default class LoginDlgImpl extends DialogBaseImpl implements LoginDlg {
    constructor(paramsTest: Object) {
        super("LoginDlgImpl");
    }

    /*
     * Returns a string that is the HTML content of the dialog
     */
    render = (): string => {
        let header = this.makeHeader("Login");

        let formControls = this.makeEditField("User", "userName") + //
            this.makePasswordField("Password", "password");

        let loginButton = this.makeButton("Login", "loginButton", this.login);
        let resetPasswordButton = this.makeButton("Forgot Password", "resetPasswordButton", this.resetPassword);
        let backButton = this.makeCloseButton("Close", "cancelLoginButton");
        let buttonBar = render.centeredButtonBar(loginButton + resetPasswordButton + backButton);
        let divider = tag.dlgSectionHeading("Or Login With...");

        let form = formControls + buttonBar;

        let mainContent = form;
        let content = header + mainContent;

        this.bindEnterKey("userName", user.login);
        this.bindEnterKey("password", user.login);
        return content;
    }

    init = (): void => {
        this.populateFromCookies();
    }

    populateFromCookies = (): void => {
        let usr = util.getCookie(cnst.COOKIE_LOGIN_USR);
        let pwd = util.getCookie(cnst.COOKIE_LOGIN_PWD);

        if (usr) {
            this.setInputVal("userName", usr);
        }
        if (pwd) {
            this.setInputVal("password", pwd);
        }
    }

    login = (): void => {
        let usr = this.getInputVal("userName");
        let pwd = this.getInputVal("password");

        user.login(this, usr, pwd);
    }

    resetPassword = (): any => {
        let usr = this.getInputVal("userName");

        Factory.createDefault("ConfirmDlgImpl", (dlg: ConfirmDlg) => {
            dlg.open();
        }, {
                "title": "Confirm Reset Password",
                "message": "Reset your password ?<p>You'll still be able to login with your old password until the new one is set.",
                "buttonText": "Yes, reset.", "yesCallback":
                () => {
                    this.cancel();
                    Factory.createDefault("ResetPasswordDlgImpl", (dlg: ResetPasswordDlg) => {
                        dlg.open();
                    }, { "user": usr });
                }
            });
    }
}
