package com.meta64.mobile.request;

import com.meta64.mobile.request.base.OakRequestBase;

public class ExportRequest extends OakRequestBase {
	private String nodeId;

	/*
	 * short file name (i.e. not including folder or extension) of target file to be created
	 * containing the export. It's always stored in the folder specified by adminDataFolder
	 * application property. If a filename that already exists is specified, the entire export is
	 * rejected, and aborted with error. (i.e. Will never overwrite existing files)
	 */
	private String targetFileName;

	// must be XML+ZIP, and selects which type of file to export
	private String exportExt;

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	public String getTargetFileName() {
		return targetFileName;
	}

	public void setTargetFileName(String targetFileName) {
		this.targetFileName = targetFileName;
	}

	public String getExportExt() {
		return exportExt;
	}

	public void setExportExt(String exportExt) {
		this.exportExt = exportExt;
	}
}
