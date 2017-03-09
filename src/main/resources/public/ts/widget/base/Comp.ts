console.log("Comp.ts");

import { util } from "../../Util";
import { domBind } from "../../DomBind";

export abstract class Comp {

    private static guid: number = 0;

    static idToCompMap: { [key: string]: Comp } = {};
    attribs: Object;

    /* Note: NULL elements are allowed in this array and simply don't render anything, and are required to be tolerated and ignored */
    children: Comp[];

    /* State tells us if the widget is currently about to re-render itself as soon as it can */
    renderPending : boolean = false;

    constructor(attribs: Object) {
        this.attribs = attribs || {};
        this.children = [];
        let id = "Comp_" + Comp.nextGuid();
        (<any>this.attribs).id = id;

        //This map allows us to lookup the Comp directly by its ID similar to a DOM lookup
        Comp.idToCompMap[id] = this;
    }

    static nextGuid(): number {
        return ++Comp.guid;
    }

    static findById(id: string): Comp {
        return Comp.idToCompMap[id];
    }

    removeAllChildren = (): void => {
        this.children = [];
    }

    getId = (): string => {
        return (<any>this.attribs).id;
    }

    /* Warning: Under lots of circumstances it's better to call domBind.whenElm rather than getElement() because getElement returns
    null unless the element is already created and rendered onto the DOM */
    getElement = (): HTMLElement => {
        return <HTMLElement>document.querySelector("#" + this.getId());
    }

    setDisplay = (showing: boolean): void => {
        domBind.whenElm(this.getId(), (elm) => {
            util.setElmDisplay(elm, showing);
        });
    }

    setVisible = (visible: boolean) => {
        domBind.whenElm(this.getId(), (elm) => {
            util.setElmDisplay(elm, visible);
        });
    }

    setClass = (clazz: string): void => {
        (<any>this.attribs).class = clazz;
    }

    setOnClick = (onclick: Function): void => {
        (<any>this.attribs).onclick = onclick;
    }

    renderToDom = (): void => {
        if (this.renderPending) return;
        this.renderPending = true;
        domBind.whenElm(this.getId(), (elm) => {
            elm.innerHTML = this.render();
            this.renderPending = false;
        });
    }

    setInnerHTML = (html: string) => {
        domBind.whenElm(this.getId(), (elm) => {
            elm.innerHTML = html;
        });
    }

    addChild = (comp: Comp): void => {
        this.children.push(comp);
    }

    addChildren = (comps: Comp[]): void => {
        this.children.push.apply(this.children, comps);
    }

    setChildren = (comps: Comp[]) => {
        this.children = comps || [];
    }

    renderChildren = (): string => {
        let html = "";
        util.forEachArrElm(this.children, function(child, idx) {
            if (child) {
                let childRender = child.render();
                if (childRender) {
                    html += childRender;
                }
            }
        });
        return html;
    }

    render = (): string => {
        return this.renderChildren();
    }
}
