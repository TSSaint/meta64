console.log("Div.ts");

import { Comp } from "./base/Comp";
import { tag } from "../Tag";

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class Span extends Comp {

    constructor(public content: string = "", attribs : Object = {}, initialChildren: Comp[] = null) {
        super(attribs);
        this.setChildren(initialChildren);
    }

    /* Div element is a special case where it renders just its children if there are any, and if not it renders 'content' */
    render = (): string => {
        return tag.span(this.attribs, (this.content || "") + this.renderChildren());
    }
}
