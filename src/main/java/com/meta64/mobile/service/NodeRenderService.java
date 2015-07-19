package com.meta64.mobile.service;

import java.util.LinkedList;
import java.util.List;
import java.util.NoSuchElementException;

import javax.jcr.Node;
import javax.jcr.NodeIterator;
import javax.jcr.Session;
import javax.jcr.nodetype.NodeType;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseBody;

import com.meta64.mobile.config.SessionContext;
import com.meta64.mobile.model.NodeInfo;
import com.meta64.mobile.repo.OakRepositoryBean;
import com.meta64.mobile.request.AnonPageLoadRequest;
import com.meta64.mobile.request.RenderNodeRequest;
import com.meta64.mobile.response.AnonPageLoadResponse;
import com.meta64.mobile.response.RenderNodeResponse;
import com.meta64.mobile.user.RunAsJcrAdmin;
import com.meta64.mobile.util.Convert;
import com.meta64.mobile.util.JcrUtil;
import com.meta64.mobile.util.Log;
import com.meta64.mobile.util.ThreadLocals;
import com.meta64.mobile.util.XString;

/**
 * Service for rendering the content of a page.
 */
@Component
@Scope("session")
public class NodeRenderService {
	private static final Logger log = LoggerFactory.getLogger(NodeRenderService.class);

	@Value("${anonUserLandingPageNode}")
	private String anonUserLandingPageNode;
	
	@Autowired
	private OakRepositoryBean oak;

	@Autowired
	private SessionContext sessionContext;

	@Autowired
	private RunAsJcrAdmin adminRunner;

	public void renderNode(Session session, RenderNodeRequest req, RenderNodeResponse res) throws Exception {

		List<NodeInfo> children = new LinkedList<NodeInfo>();
		res.setChildren(children);

		String targetId = req.getNodeId();
		// log.debug("renderNode targetId:" + targetId);

		Node node;
		try {
			node = JcrUtil.findNode(session, targetId);
		}
		catch (Exception e) {
			res.setMessage("Node not found.");
			res.setSuccess(false);
			return;
		}

		if (req.isRenderParentIfLeaf() && !Convert.hasDisplayableNodes(node)) {
			res.setDisplayedParent(true);
			req.setUpLevel(1);
		}

		int levelsUpRemaining = req.getUpLevel();
		while (node != null && levelsUpRemaining > 0) {
			node = node.getParent();
			if (Log.renderNodeRequest) {
				// System.out.println("   upLevel to nodeid: "+item.getPath());
			}
			levelsUpRemaining--;
		}

		NodeInfo nodeInfo = Convert.convertToNodeInfo(session, node);
		NodeType type = node.getPrimaryNodeType();
		boolean ordered = type.hasOrderableChildNodes();
		nodeInfo.setChildrenOrdered(ordered);
		// System.out.println("Primary type: " + type.getName() + " childrenOrdered=" +
		// ordered);
		res.setNode(nodeInfo);

		NodeIterator nodeIter = node.getNodes();
		try {
			while (true) {
				Node n = nodeIter.nextNode();
				children.add(Convert.convertToNodeInfo(session, n));
			}
		}
		catch (NoSuchElementException ex) {
			// not an error. Normal iterator end condition.
		}
	}
	
	public void anonPageLoad(Session session, AnonPageLoadRequest req, AnonPageLoadResponse res) throws Exception {

		String id = null;
		if (id == null) {
			id = !req.isIgnoreUrl() && sessionContext.getUrlId() != null ? sessionContext.getUrlId() : anonUserLandingPageNode;
		}

		if (!XString.isEmpty(id)) {
			RenderNodeResponse renderNodeRes = new RenderNodeResponse();
			RenderNodeRequest renderNodeReq = new RenderNodeRequest();

			/*
			 * if user specified an ID= parameter on the url, we display that immediately, or else
			 * we display the node that the admin has configured to be the default landing page
			 * node.
			 */
			renderNodeReq.setNodeId(id);
			renderNode(session, renderNodeReq, renderNodeRes);
			res.setRenderNodeResponse(renderNodeRes);
		}
		else {
			res.setContent("No content available.");
		}

		res.setSuccess(true);
	}
}
