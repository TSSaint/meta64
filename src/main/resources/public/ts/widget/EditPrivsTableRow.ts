console.log("EditPropsTable.ts");

import { Comp } from "./base/Comp";
import { tag } from "../Tag";
import { DialogBase } from "../DialogBase";
import * as I from "../Interfaces";
import { Div } from "./Div";
import { util } from "../Util";
import { SharingDlg } from "../SharingDlg";
import { render } from "../Render";
import { Button } from "./Button";
import { TextContent } from "./TextContent";

export class EditPrivsTableRow extends Comp {

    constructor(public sharingDlg: SharingDlg, public aclEntry: I.AccessControlEntryInfo) {
        super(null);
        (<any>this.attribs).class = "privilege-list";
        this.addChild(new Div("<h4>User: " + aclEntry.principalName + "</h4>"));

        let privElementsDiv = new Div();
        this.renderAclPrivileges(privElementsDiv, aclEntry);
        this.addChild(privElementsDiv);
    }

    renderAclPrivileges = (div: Div, aclEntry: I.AccessControlEntryInfo): void => {

        util.forEachArrElm(aclEntry.privileges, (privilege, index) => {
            let removeButton = new Button("Remove", () => {
                this.sharingDlg.removePrivilege(aclEntry.principalName, privilege.privilegeName);
            })
            div.addChild(removeButton);
            div.addChild(new TextContent("<b>" + aclEntry.principalName + "</b> has privilege <b>" + privilege.privilegeName + "</b> on this node.",
                "privilege-entry"));
        });
    }

    /* Div element is a special case where it renders just its children if there are any, and if not it renders 'content' */
    render = (): string => {
        return tag.div(this.attribs, this.renderChildren());
    }
}
