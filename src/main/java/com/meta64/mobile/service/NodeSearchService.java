package com.meta64.mobile.service;

import java.util.LinkedList;
import java.util.List;

import javax.jcr.Node;
import javax.jcr.NodeIterator;
import javax.jcr.Session;
import javax.jcr.query.Query;
import javax.jcr.query.QueryManager;
import javax.jcr.query.QueryResult;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;

import com.meta64.mobile.config.JcrProp;
import com.meta64.mobile.config.SessionContext;
import com.meta64.mobile.model.NodeInfo;
import com.meta64.mobile.repo.OakRepositoryBean;
import com.meta64.mobile.request.NodeSearchRequest;
import com.meta64.mobile.response.NodeSearchResponse;
import com.meta64.mobile.user.RunAsJcrAdmin;
import com.meta64.mobile.util.Convert;
import com.meta64.mobile.util.JcrUtil;

/**
 * A lot of docs online had tricked me into believing that Oak is using indexes for all content by
 * default but this is not the case:
 * <p>
 * http://docs.adobe.com/docs/en/aem/6-0/deploy/upgrade/queries-and-indexing.html
 * http://jackrabbit.apache.org/oak/docs/query/lucene.html
 * http://users.jackrabbit.apache.narkive.com/6sQZPTKZ/no-results-from-full-text-index-oak-1-1-6
 * https://gist.github.com/chetanmeh/c1ccc4fa588ed1af467b
 * http://jackrabbit.510166.n4.nabble.com/Oak-Creating-Indexes-td4661890.html
 * <p>
 * Service for searching the repository. This searching is currently very basic, and just grabs the
 * first 100 results and returns.
 */
@Component
@Scope("singleton")
public class NodeSearchService {
	private static final Logger log = LoggerFactory.getLogger(NodeSearchService.class);

	private static boolean useLike = true;
	private static boolean useContains = false;
	private static boolean searchAllProps = false;

	@Autowired
	private OakRepositoryBean oak;

	@Autowired
	private SessionContext sessionContext;

	@Autowired
	private RunAsJcrAdmin adminRunner;

	/*
	 * Finds an exact property match under the specified node 
	 */
	public Node findNodeByProperty(Session session, String parentPath, String propName, String propVal) throws Exception {
		QueryManager qm = session.getWorkspace().getQueryManager();

		/* 
		 * Note: This is a bad way to lookup a value that's expected to be an exact match!
		 */
		StringBuilder queryStr = new StringBuilder();
		queryStr.append("SELECT * from [nt:base] AS t WHERE ISDESCENDANTNODE([");
		queryStr.append(parentPath);
		queryStr.append("]) AND t.[" + propName + "]='");
		queryStr.append(propVal);
		queryStr.append("'");

		Query q = qm.createQuery(queryStr.toString(), Query.JCR_SQL2);
		QueryResult r = q.execute();
		NodeIterator nodes = r.getNodes();
		Node ret = null;
		if (nodes.hasNext()) {
			ret = nodes.nextNode();
		}
		
		log.debug(ret==null ? "Node not found." : "node found.");
		return ret;
	}

	/*
	 * see also: http://docs.jboss.org/jbossdna/0.7/manuals/reference/html/jcr-query-and-search.html
	 * https://wiki.magnolia-cms.com/display/WIKI/JCR+Query+Cheat+Sheet
	 */

	// see DescendantSearchTest
	public void search(Session session, NodeSearchRequest req, NodeSearchResponse res) throws Exception {

		int MAX_NODES = 100;
		Node searchRoot = JcrUtil.findNode(session, req.getNodeId());

		QueryManager qm = session.getWorkspace().getQueryManager();
		String absPath = searchRoot.getPath();

		StringBuilder queryStr = new StringBuilder();
		queryStr.append("SELECT * from [nt:base] AS t ");

		int whereCount = 0;
		if (!absPath.equals("/")) {
			if (whereCount == 0) {
				queryStr.append(" WHERE ");
			}
			whereCount++;
			queryStr.append("ISDESCENDANTNODE([");
			queryStr.append(absPath);
			queryStr.append("])");
		}

		if (req.getSearchText().length() > 0) {
			if (whereCount == 0) {
				queryStr.append(" WHERE ");
			}
			else
			/*
			 * To search ALL properties you can put 't.*' instead of 't.[jcr:content]' below.
			 */
			if (whereCount > 0) {
				queryStr.append(" AND ");
			}
			whereCount++;

			if (useContains && useLike) {
				throw new Exception("oops. Like + Contains.");
			}

			if (useContains) {
				queryStr.append("contains(t.[");
				queryStr.append(JcrProp.CONTENT);
				queryStr.append("], '");
				queryStr.append(escapeQueryString(req.getSearchText()));
				queryStr.append("')");
			}

			if (useLike) {
				queryStr.append("lower(");

				if (searchAllProps) {
					queryStr.append("*");
				}
				else {
					queryStr.append("t.[");
					queryStr.append(JcrProp.CONTENT);
					queryStr.append("]");
				}

				queryStr.append(") like '%");
				queryStr.append(escapeQueryString(req.getSearchText()));
				queryStr.append("%'");
			}
		}

		/*
		 * TODO: Currently if there is no WHERE clause then lucene fails to see any restrictions and 
		 * resorts to a full scan, which is slow. Need to add the ability to use lucene index for 
		 * sorting on the lastModified field.
		 */
		if (req.isModSortDesc()) {
			queryStr.append(" ORDER BY [");
			queryStr.append(JcrProp.LAST_MODIFIED);
			queryStr.append("] DESC");
		}

		Query q = qm.createQuery(queryStr.toString(), Query.JCR_SQL2);
		QueryResult r = q.execute();
		NodeIterator nodes = r.getNodes();
		int counter = 0;
		List<NodeInfo> searchResults = new LinkedList<NodeInfo>();
		res.setSearchResults(searchResults);

		while (nodes.hasNext()) {
			searchResults.add(Convert.convertToNodeInfo(sessionContext, session, nodes.nextNode()));
			if (counter++ > MAX_NODES) {
				break;
			}
		}
		res.setSuccess(true);
		log.debug("search results count: " + counter);
	}

	private String escapeQueryString(String query) {
		return query.replaceAll("'", "''");
	}
}
