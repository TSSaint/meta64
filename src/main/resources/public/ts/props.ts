console.log("running module: props.js");

namespace m64 {
    export namespace props {

        /*
         * Toggles display of properties in the gui.
         */
        export let propsToggle = function() {
            meta64.showProperties = meta64.showProperties ? false : true;
            // setDataIconUsingId("#editModeButton", editMode ? "edit" :
            // "forbidden");

            // fix for polymer
            // var elm = $("#propsToggleButton");
            // elm.toggleClass("ui-icon-grid", meta64.showProperties);
            // elm.toggleClass("ui-icon-forbidden", !meta64.showProperties);

            render.renderPageFromData();
            view.scrollToSelectedNode();
            meta64.selectTab("mainTabName");
        }

        export let deletePropertyFromLocalData = function(propertyName) {
            for (var i = 0; i < edit.editNode.properties.length; i++) {
                if (propertyName === edit.editNode.properties[i].name) {
                    // splice is how you delete array elements in js.
                    edit.editNode.properties.splice(i, 1);
                    break;
                }
            }
        }

        /*
         * Sorts props input array into the proper order to show for editing. Simple algorithm first grabs 'jcr:content'
         * node and puts it on the top, and then does same for 'jctCnst.TAGS'
         */
        export let getPropertiesInEditingOrder = function(props) {
            var propsNew = props.clone();
            var targetIdx = 0;

            var tagIdx = propsNew.indexOfItemByProp("name", jcrCnst.CONTENT);
            if (tagIdx != -1) {
                propsNew.arrayMoveItem(tagIdx, targetIdx++);
            }

            tagIdx = propsNew.indexOfItemByProp("name", jcrCnst.TAGS);
            if (tagIdx != -1) {
                propsNew.arrayMoveItem(tagIdx, targetIdx++);
            }

            return propsNew;
        }

        /*
         * properties will be null or a list of PropertyInfo objects.
         *
         * todo-3: I can do much better in this method, I just haven't had time to clean it up. this method is ugly.
         */
        export let renderProperties = function(properties) {
            if (properties) {
                var ret = "<table border=1 class='property-table'>";
                var propCount = 0;

                $.each(properties, function(i, property) {
                    if (render.allowPropertyToDisplay(property.name)) {
                        var isBinaryProp = render.isBinaryProperty(property.name);

                        propCount++;
                        ret += "<tr class='prop-table-row'>";

                        ret += "<td class='prop-table-name-col'>" + render.sanitizePropertyName(property.name)
                            + "</td>";

                        if (isBinaryProp) {
                            ret += "<td class='prop-table-val-col'>[binary]</td>";
                        } else if (!property.values) {
                            var val = property.htmlValue ? property.htmlValue : property.value;
                            ret += "<td class='prop-table-val-col'>" + render.wrapHtml(val) + "</td>";
                        } else {
                            ret += "<td class='prop-table-val-col'>" + props.renderPropertyValues(property.values)
                                + "</td>";
                        }
                        ret += "</tr>";
                    } else {
                        console.log("Hiding property: " + property.name);
                    }
                });

                if (propCount == 0) {
                    return "";
                }

                ret += "</table>";
                return ret;
            } else {
                return undefined;
            }
        }

        /*
         * brute force searches on node (NodeInfo.java) object properties list, and returns the first property
         * (PropertyInfo.java) with name matching propertyName, else null.
         */
        export let getNodeProperty = function(propertyName, node) {
            if (!node || !node.properties)
                return null;

            for (var i = 0; i < node.properties.length; i++) {
                var prop = node.properties[i];
                if (prop.name === propertyName) {
                    return prop;
                }
            }
            return null;
        }

        export let getNodePropertyVal = function(propertyName, node) {
            var prop = getNodeProperty(propertyName, node);
            return prop ? prop.value : null;
        }

        /*
         * Returns trus if this is a comment node, that the current user doesn't own. Used to disable "edit", "delete",
         * etc. on the GUI.
         */
        export let isNonOwnedNode = function(node) {
            var createdBy = getNodePropertyVal(jcrCnst.CREATED_BY, node);

            // if we don't know who owns this node assume the admin owns it.
            if (!createdBy) {
                createdBy = "admin";
            }

            /* This is OR condition because of createdBy is null we assume we do not own it */
            return createdBy != meta64.userName;
        }

        /*
         * Returns true if this is a comment node, that the current user doesn't own. Used to disable "edit", "delete",
         * etc. on the GUI.
         */
        export let isNonOwnedCommentNode = function(node) {
            var commentBy = getNodePropertyVal(jcrCnst.COMMENT_BY, node);
            return commentBy != null && commentBy != meta64.userName;
        }

        export let isOwnedCommentNode = function(node) {
            var commentBy = getNodePropertyVal(jcrCnst.COMMENT_BY, node);
            return commentBy != null && commentBy == meta64.userName;
        }

        /*
         * Returns string representation of property value, even if multiple properties
         */
        export let renderProperty = function(property) {
            if (!property.values) {
                if (!property.value || property.value.length == 0) {
                    return "";
                }
                // todo-1: make sure this wrapHtml isn't creating an unnecessary DIV element.
                return render.wrapHtml(property.htmlValue);
            } else {
                return renderPropertyValues(property.values);
            }
        }

        export let renderPropertyValues = function(values) {
            var ret = "<div>";
            var count = 0;
            $.each(values, function(i, value) {
                if (count > 0) {
                    ret += cnst.BR;
                }
                ret += render.wrapHtml(value);
                count++;
            });
            ret += "</div>";
            return ret;
        }
    }
}
