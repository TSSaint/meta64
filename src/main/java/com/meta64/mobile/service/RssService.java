package com.meta64.mobile.service;

import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.NoSuchElementException;

import javax.jcr.Node;
import javax.jcr.NodeIterator;
import javax.jcr.Session;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.meta64.mobile.config.JcrName;
import com.meta64.mobile.config.JcrProp;
import com.meta64.mobile.config.SpringContextUtil;
import com.meta64.mobile.rss.RssReader;
import com.meta64.mobile.user.RunAsJcrAdmin;
import com.meta64.mobile.util.JcrUtil;

/* WARNING: To anyone who downloads meta64, beware the RSS stuff is a work in progress that I started, and anything related to RSS
 * is untested code and the commented code you see comes from the older version of the software and is in the process of being converted.
 * Bottom line, don't try to use any RSS code or features yet.
 */

/**
 * RSS Feed Processing
 * 
 * This class is experimental and is not yet complete!
 *
 */
@Component
public class RssService {
	private static final Logger log = LoggerFactory.getLogger(RssService.class);

	@Autowired
	private RunAsJcrAdmin adminRunner;
	
	private Node rssRoot;
	private Node feedsRootNode;
	
	/* List of nodes and hashmap for looking them up quickly by URI 
	 * 
	 * todo-0: revisit concurrent access to these collections. May need some locking.
	 * */
	private List<Node> feedNodes = new LinkedList<Node>();
	private HashMap<String, Node> feedsByUri = new HashMap<String, Node>();
	private HashMap<String, Node> feedsByLink = new HashMap<String, Node>();
	private HashMap<String, Node> entriesByLink = new HashMap<String, Node>();
	
	public void readFeeds() throws Exception {
		
		adminRunner.run((Session session) -> {
			try {
				init(session);
				
				RssReader reader = (RssReader) SpringContextUtil.getBean(RssReader.class);
				try {
					reader.run(session);
				}
				catch (Exception e) {
					log.error("Failed processing RSS feeds", e);
				}
				
				session.save();
			}
			catch (Exception e) {
				log.debug("failed processing RSS", e);
			}
		});
	}
	
	public Node getFeedsRootNode() {
		return feedsRootNode;
	}
	
	public Node getFeedNodeByUri(String uri) {
		return feedsByUri.get(uri);
	}
	
	public Node getFeedNodeByLink(String link) {
		return feedsByLink.get(link);
	}
	
	public Node getEntryByLink(String link) {
		return entriesByLink.get(link);
	}
	
	public void init(Session session) throws Exception {
		 rssRoot = JcrUtil.ensureNodeExists(session, "/", JcrName.RSS, "RSS");
		 feedsRootNode = JcrUtil.ensureNodeExists(session, "/" + JcrName.RSS + "/", JcrName.RSS_FEEDS, "RSS Feeds");
		 cacheCurrentFeedNodes();
	}
	
	private void cacheCurrentFeedNodes() throws Exception {
		feedNodes.clear();
		feedsByUri.clear();
		
		NodeIterator nodeIter = feedsRootNode.getNodes();
		try {
			while (true) {
				Node feedNode = nodeIter.nextNode();
				feedNodes.add(feedNode);
				String uriProp = JcrUtil.safeGetStringProp(feedNode, JcrProp.RSS_FEED_URI);
				if (uriProp != null) {
					feedsByUri.put(uriProp, feedNode);
				}
				String linkProp = JcrUtil.safeGetStringProp(feedNode, JcrProp.RSS_FEED_LINK);
				if (linkProp != null) {
					feedsByLink.put(linkProp, feedNode);
				}
				cacheFeedEntries(feedNode);
			}
		}
		catch (NoSuchElementException ex) {
			// not an error. Normal iterator end condition.
		}
	}
	
	private void cacheFeedEntries(Node feedNode) throws Exception {
		
		NodeIterator nodeIter = feedNode.getNodes();
		try {
			while (true) {
				Node entryNode = nodeIter.nextNode();
				String linkProp = JcrUtil.safeGetStringProp(entryNode, JcrProp.RSS_FEED_LINK);
				if (linkProp != null) {
					entriesByLink.put(linkProp, entryNode);
				}
			}
		}
		catch (NoSuchElementException ex) {
			// not an error. Normal iterator end condition.
		}
	}
}
