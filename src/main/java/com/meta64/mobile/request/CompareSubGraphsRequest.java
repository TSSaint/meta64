package com.meta64.mobile.request;

import com.meta64.mobile.request.base.OakRequestBase;

public class CompareSubGraphsRequest extends OakRequestBase {
	private String nodeIdA;
	private String nodeIdB;
	
	public String getNodeIdA() {
		return nodeIdA;
	}
	
	public void setNodeIdA(String nodeIdA) {
		this.nodeIdA = nodeIdA;
	}
	
	public String getNodeIdB() {
		return nodeIdB;
	}
	
	public void setNodeIdB(String nodeIdB) {
		this.nodeIdB = nodeIdB;
	}
}
