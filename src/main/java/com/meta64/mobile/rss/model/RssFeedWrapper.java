package com.meta64.mobile.rss.model;

import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;

import com.sun.syndication.feed.synd.SyndFeed;

public class RssFeedWrapper {
	/* url of feed. The RSS xml file */
	private String url;

	private SyndFeed feed;
	private final List<RssEntryWrapper> entryList = new LinkedList<RssEntryWrapper>();

	/*
	 * for any given feed, we want to avoid showing the same sampled image twice which can happen
	 * sometimes, and doesn't look right, so we have this map to be sure not to do this
	 */
	private final HashSet<String> sampledImageMap = new HashSet<String>();

	public RssFeedWrapper(SyndFeed feed, String url) {
		this.feed = feed;
		this.url = url;
	}

	public void dump(String indent, StringBuilder sb) {
		sb.append("RssFeedWrapper Dump:\n");
		sb.append("Author: " + feed.getAuthor() + "\n");
		sb.append("Description: " + feed.getDescription() + "\n");

		for (RssEntryWrapper entry : entryList) {
			entry.dump(indent, sb);
		}
	}

	public SyndFeed getFeed() {
		return feed;
	}

	public List<RssEntryWrapper> getEntryList() {
		return entryList;
	}

	public HashSet<String> getSampledImageMap() {
		return sampledImageMap;
	}

	public String getUrl() {
		return url;
	}

	public void setUrl(String url) {
		this.url = url;
	}
}
