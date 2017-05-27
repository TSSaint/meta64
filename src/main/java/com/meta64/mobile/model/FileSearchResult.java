package com.meta64.mobile.model;

/**
 * Model representing a filename
 *
 */
public class FileSearchResult {
	private String fileName;

	public FileSearchResult() {
	}

	public FileSearchResult(String fileName) {
		this.fileName = fileName;
	}

	public String getFileName() {
		return fileName;
	}

	public void setFileName(String fileName) {
		this.fileName = fileName;
	}
}
