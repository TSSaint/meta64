package com.meta64.mobile.request;

import com.meta64.mobile.request.base.OakRequestBase;

public class SavePropertyRequest extends OakRequestBase {
	private String nodeId;
	private String propertyName;
	private String propertyValue;

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	public String getPropertyName() {
		return propertyName;
	}

	public void setPropertyName(String propertyName) {
		this.propertyName = propertyName;
	}

	public String getPropertyValue() {
		return propertyValue;
	}

	public void setPropertyValue(String propertyValue) {
		this.propertyValue = propertyValue;
	}

}
