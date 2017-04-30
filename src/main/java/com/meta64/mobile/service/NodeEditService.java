package com.meta64.mobile.service;

import java.util.Calendar;

import javax.jcr.Node;
import javax.jcr.NodeIterator;
import javax.jcr.Property;
import javax.jcr.Session;
import javax.jcr.Value;
import javax.jcr.query.Query;
import javax.jcr.query.QueryManager;
import javax.jcr.query.QueryResult;

import org.apache.commons.lang3.StringUtils;
import org.apache.jackrabbit.JcrConstants;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.meta64.mobile.config.JcrName;
import com.meta64.mobile.config.JcrProp;
import com.meta64.mobile.config.SessionContext;
import com.meta64.mobile.mail.JcrOutboxMgr;
import com.meta64.mobile.model.NodeInfo;
import com.meta64.mobile.model.PropertyInfo;
import com.meta64.mobile.repo.OakRepository;
import com.meta64.mobile.request.CreateSubNodeRequest;
import com.meta64.mobile.request.DeletePropertyRequest;
import com.meta64.mobile.request.InsertNodeRequest;
import com.meta64.mobile.request.RenameNodeRequest;
import com.meta64.mobile.request.SaveNodeRequest;
import com.meta64.mobile.request.SavePropertyRequest;
import com.meta64.mobile.request.SplitNodeRequest;
import com.meta64.mobile.response.CreateSubNodeResponse;
import com.meta64.mobile.response.DeletePropertyResponse;
import com.meta64.mobile.response.InsertNodeResponse;
import com.meta64.mobile.response.RenameNodeResponse;
import com.meta64.mobile.response.SaveNodeResponse;
import com.meta64.mobile.response.SavePropertyResponse;
import com.meta64.mobile.response.SplitNodeResponse;
import com.meta64.mobile.user.RunAsJcrAdmin;
import com.meta64.mobile.util.Convert;
import com.meta64.mobile.util.JcrUtil;
import com.meta64.mobile.util.RuntimeEx;
import com.meta64.mobile.util.ThreadLocals;

/**
 * Service for editing content of nodes. That is, this method updates property values of JCR nodes.
 */
@Component
public class NodeEditService {
	private static final Logger log = LoggerFactory.getLogger(NodeEditService.class);

	private static final String SPLIT_TAG = "{split}";

	@Autowired
	private Convert convert;

	@Autowired
	private OakRepository oak;

	@Autowired
	private SessionContext sessionContext;

	@Autowired
	private JcrOutboxMgr outboxMgr;

	@Autowired
	private NodeMoveService nodeMoveService;

	/*
	 * Creates a new node as a *child* node of the node specified in the request.
	 */
	public void createSubNode(Session session, CreateSubNodeRequest req, CreateSubNodeResponse res) {
		try {
			if (session == null) {
				session = ThreadLocals.getJcrSession();
			}

			String nodeId = req.getNodeId();
			Node node = JcrUtil.findNode(session, nodeId);
			String curUser = session.getUserID();

			String parentPath = node.getPath() + "/";
			boolean createUnderRoot = false;
			/*
			 * if we are moving nodes around on the root, the root belongs to admin and needs
			 * special access (adminRunner)
			 */
			if (parentPath.equals("/" + JcrName.ROOT + "/" + sessionContext.getUserName() + "/")) {
				createUnderRoot = true;
			}

			/*
			 * If this is a publicly appendable node, then we always use admin to append a comment
			 * type node under it. No other type of child node creation is allowed.
			 */
			boolean publicAppend = JcrUtil.isPublicAppend(node);
			boolean asAdminNow = false;
			if (publicAppend) {
				// todo-0: everywhere that I'm doing this pattern of logout of active session, and
				// switch to more powerful admin session,
				// I should try using the session.impersonate() which i think was designed for this
				// very purpose I need.
				log.debug("Switch to admin user.");
				session.logout();
				session = oak.newAdminSession();
				asAdminNow = true;
				// jcrUtil.impersonateAdminCredentials(session);
				node = JcrUtil.findNode(session, nodeId);
			}

			String name = StringUtils.isEmpty(req.getNewNodeName()) ? JcrUtil.getGUID() : req.getNewNodeName();

			Node newNode = null;
			/* NT_UNSTRUCTURED IS ORDERABLE */
			if (req.getTypeName() != null && !JcrConstants.NT_UNSTRUCTURED.equalsIgnoreCase(req.getTypeName())) {
				newNode = node.addNode(name, req.getTypeName());
			}
			else {
				newNode = node.addNode(name, JcrConstants.NT_UNSTRUCTURED);
				newNode.setProperty(JcrProp.CONTENT, "");
			}

			JcrUtil.timestampNewNode(session, newNode);

			if (publicAppend) {
				newNode.setProperty(JcrProp.COMMENT_BY, curUser);
				newNode.setProperty(JcrProp.PUBLIC_APPEND, true);
			}

			log.debug("session.save()");
			JcrUtil.save(session);

			res.setNewNode(convert.convertToNodeInfo(sessionContext, session, newNode, true, true, false));
			res.setSuccess(true);

			/*
			 * todo-0: enhancement here would be to detect if this is the first child added to this
			 * node, and if so, then skip the code to move the new node to the top, because it's
			 * wasted CPU cycles.
			 */
			if (req.isCreateAtTop()) {
				log.debug("is create at top");
				/*
				 * We have to create a new session to run the move node because that is operating on
				 * a node we do not own. Account root nodes are technically owned by admin
				 */
				if (createUnderRoot) {
					/*
					 * get the newNodeId from 'newNode' object, and beware we cannot access the
					 * 'newNode' object itself in memory after we close this current session.
					 */
					String newNodeId = newNode.getIdentifier();

					if (!asAdminNow) {
						log.debug("switching to admin.");
						session.logout();
						session = oak.newAdminSession();
						// jcrUtil.impersonateAdminCredentials(session);
					}

					/* gets a different 'newNode' object, this time specific to the new session */
					newNode = JcrUtil.findNode(session, newNodeId);
				}
				nodeMoveService.moveNodeToTop(session, newNode, true, true, false);
			}
		}
		catch (Exception ex) {
			throw new RuntimeEx(ex);
		}
	}

	/*
	 * Creates a new node that is a sibling (same parent) of and at the same ordinal position as the
	 * node specified in the request.
	 */
	public void insertNode(Session session, InsertNodeRequest req, InsertNodeResponse res) {
		try {
			if (session == null) {
				session = ThreadLocals.getJcrSession();
			}
			String parentNodeId = req.getParentId();
			log.debug("Inserting under parent: " + parentNodeId);
			Node parentNode = JcrUtil.findNode(session, parentNodeId);

			// IMPORTANT: Only editing actual content requires a "createdBy"
			// checking by JcrUtil.checkNodeCreatedBy

			String name = StringUtils.isEmpty(req.getNewNodeName()) ? JcrUtil.getGUID() : req.getNewNodeName();

			Node newNode = null;
			if (req.getTypeName() != null && !JcrConstants.NT_UNSTRUCTURED.equalsIgnoreCase(req.getTypeName())) {
				newNode = parentNode.addNode(name, req.getTypeName());
			}
			else {
				newNode = parentNode.addNode(name, JcrConstants.NT_UNSTRUCTURED);
				newNode.setProperty(JcrProp.CONTENT, "");
			}

			JcrUtil.timestampNewNode(session, newNode);

			if (!StringUtils.isEmpty(req.getTargetName())) {
				parentNode.orderBefore(newNode.getName(), req.getTargetName());
			}

			JcrUtil.save(session);
			res.setNewNode(convert.convertToNodeInfo(sessionContext, session, newNode, true, true, false));
			res.setSuccess(true);
		}
		catch (Exception ex) {
			throw new RuntimeEx(ex);
		}
	}

	/*
	 * Renames the node to a new node name specified in the request. In JCR the way you 'rename' a
	 * node is actually by moving it to a new location, which actually under the same parent.
	 */
	public void renameNode(Session session, RenameNodeRequest req, RenameNodeResponse res) {
		try {
			if (session == null) {
				session = ThreadLocals.getJcrSession();
			}

			String nodeId = req.getNodeId();
			Node node = JcrUtil.findNode(session, nodeId);
			JcrUtil.checkWriteAuthorized(node, session.getUserID());

			/* make the node referencable, required for accessing via URL */
			if (node != null) {
				/*
				 * if node already has uuid then we can do nothing here, we just silently return
				 * success
				 */
				if (!node.hasProperty(JcrProp.UUID)) {
					node.addMixin(JcrConstants.MIX_REFERENCEABLE);
				}
			}

			String newName = req.getNewName().trim();
			if (newName.length() == 0) {
				throw new RuntimeEx("No node name provided.");
			}

			log.debug("Renaming node: " + nodeId);

			if (!JcrUtil.isUserAccountRoot(sessionContext, node)) {
				JcrUtil.checkWriteAuthorized(node, session.getUserID());
			}

			Node parentNode = node.getParent();
			String parentPath = parentNode.getPath();
			String newPath = (parentPath.equals("/") ? "" : parentPath) + "/" + newName;

			Node checkExists = JcrUtil.safeFindNode(session, newPath);
			if (checkExists != null) {
				throw new RuntimeEx("Node already exists");
			}

			/*
			 * Because we support renaming of the root node of a page (GUI page) we cannot expect
			 * the client to be able so send the 'nodeBelow' so we have to find that on the server
			 * side.
			 */
			Node nodeBelow = JcrUtil.getNodeBelow(session, null, node, null);
			session.move(node.getPath(), newPath);

			/*
			 * This orderBefore, is required to maintain the same ordinal ordering position after
			 * the rename. If the node we are renaming is already the bottom node we will have null
			 * for nodeBelow
			 */
			if (nodeBelow != null) {
				parentNode.orderBefore(newName, nodeBelow.getName());
			}
			JcrUtil.save(session);

			/*
			 * Now lookup the new node using new path, so we get the value that node.getIdentifier()
			 * returns for it now, which may or may not be the actual new path
			 */
			node = JcrUtil.findNode(session, newPath);
			if (node == null) {
				throw new RuntimeEx("Failed to be able to readback node just named: " + newPath);
			}
			res.setNewId(node.getIdentifier());
			res.setSuccess(true);
		}
		catch (Exception ex) {
			throw new RuntimeEx(ex);
		}
	}

	/*
	 * Saves the value(s) of properties on the node specified in the request.
	 */
	public void saveProperty(Session session, SavePropertyRequest req, SavePropertyResponse res) {
		try {
			if (session == null) {
				session = ThreadLocals.getJcrSession();
			}
			String nodeId = req.getNodeId();
			Node node = JcrUtil.findNode(session, nodeId);
			JcrUtil.checkWriteAuthorized(node, session.getUserID());
			node.setProperty(req.getPropertyName(), req.getPropertyValue());
			JcrUtil.save(session);

			PropertyInfo propertySaved = new PropertyInfo(-1, req.getPropertyName(), req.getPropertyValue(), false, null);
			res.setPropertySaved(propertySaved);
			res.setSuccess(true);
		}
		catch (Exception ex) {
			throw new RuntimeEx(ex);
		}
	}

	/*
	 * Saves the node with new information based on whatever is specified in the request.
	 */
	public void saveNode(Session session, SaveNodeRequest req, SaveNodeResponse res) {
		try {
			if (session == null) {
				session = ThreadLocals.getJcrSession();
			}
			String nodeId = req.getNodeId();

			// log.debug("saveNode. nodeId=" + nodeId);
			Node node = JcrUtil.findNode(session, nodeId);

			String commentBy = JcrUtil.safeGetStringProp(node, JcrProp.COMMENT_BY);
			if (commentBy != null) {
				if (!commentBy.equals(session.getUserID())) {
					throw new RuntimeEx("You cannot edit someone elses comment.");
				}
				session.logout();
				session = oak.newAdminSession();
				node = JcrUtil.findNode(session, nodeId);
			}
			else {
				JcrUtil.checkWriteAuthorized(node, session.getUserID());
			}

			if (req.getProperties() != null) {
				for (PropertyInfo property : req.getProperties()) {

					/*
					 * save only if server determines the property is savable. Just protection.
					 * Client shouldn't be trying to save stuff that is illegal to save, but we have
					 * to assume the worst behavior from client code, for security and robustness.
					 */
					if (JcrUtil.isSavableProperty(property.getName())) {
						// log.debug("Property to save: " + property.getName() + "="
						// +
						// property.getValue());
						JcrUtil.savePropertyToNode(node, property);
					}
					else {
						/**
						 * TODO: This case indicates that data was sent unnecessarily. fix! (i.e.
						 * make sure this block cannot ever be entered)
						 */
						// log.debug("Ignoring unneeded save attempt on unneeded
						// prop: " + property.getName());
					}
				}

				Calendar lastModified = Calendar.getInstance();
				node.setProperty(JcrProp.LAST_MODIFIED, lastModified);
				node.setProperty(JcrProp.LAST_MODIFIED_BY, session.getUserID());

				if (req.isSendNotification()) {
					if (commentBy != null) {
						outboxMgr.sendNotificationForChildNodeCreate(node, commentBy, JcrProp.COMMENT_BY);
					}
					else {
						outboxMgr.sendNotificationForChildNodeCreate(node, sessionContext.getUserName(), JcrProp.CREATED_BY);
					}
				}

				NodeInfo nodeInfo = convert.convertToNodeInfo(sessionContext, session, node, true, true, false);
				res.setNode(nodeInfo);
				JcrUtil.save(session);
			}

			res.setSuccess(true);
		}
		catch (Exception ex) {
			throw new RuntimeEx(ex);
		}
	}

	/*
	 * Removes the property specified in the request from the node specified in the request
	 */
	public void deleteProperty(Session session, DeletePropertyRequest req, DeletePropertyResponse res) {
		if (session == null) {
			session = ThreadLocals.getJcrSession();
		}
		String nodeId = req.getNodeId();
		Node node = JcrUtil.findNode(session, nodeId);
		JcrUtil.checkWriteAuthorized(node, session.getUserID());
		String propertyName = req.getPropName();
		try {
			Property prop = node.getProperty(propertyName);
			if (prop != null) {
				prop.remove();
			}
			else {
				throw new RuntimeEx("Unable to find property to delete: " + propertyName);
			}
		}
		catch (Exception e) {
			/*
			 * Don't rethrow this exception. We want to keep processing any properties we can
			 * successfully process
			 */
			log.info("Failed to delete property: " + propertyName + " Reason: " + e.getMessage());
		}

		JcrUtil.save(session);
		res.setSuccess(true);
	}

	/*
	 * When user pastes in a large amount of text and wants to have this text broken out into
	 * individual nodes one way to do this is put the keyword "{split}" everywhere in the content
	 * you want it cut, and this splitNode method will break it all up into individual nodes.
	 */
	public void splitNode(Session session, SplitNodeRequest req, SplitNodeResponse res) {
		try {
			if (session == null) {
				session = ThreadLocals.getJcrSession();
			}
			String nodeId = req.getNodeId();
			String nodeBelowId = req.getNodeBelowId();
			Node nodeBelow = null;

			if (nodeBelowId != null) {
				nodeBelow = JcrUtil.findNode(session, nodeBelowId);
			}

			log.debug("Splitting node: " + nodeId);
			Node node = JcrUtil.findNode(session, nodeId);
			Node parentNode = node.getParent();

			if (!JcrUtil.isUserAccountRoot(sessionContext, node)) {
				JcrUtil.checkWriteAuthorized(node, session.getUserID());
			}

			String content = JcrUtil.getRequiredStringProp(node, JcrProp.CONTENT);

			/*
			 * If split will have no effect, just return as if successful.
			 */
			if (!content.contains(SPLIT_TAG)) {
				res.setSuccess(true);
				return;
			}

			String[] contentParts = StringUtils.splitByWholeSeparator(content, SPLIT_TAG);

			int idx = 0;
			for (String part : contentParts) {
				if (idx == 0) {
					node.setProperty(JcrProp.CONTENT, part);
				}
				else {
					String newNodeName = JcrUtil.getGUID();
					Node newNode = parentNode.addNode(newNodeName, JcrConstants.NT_UNSTRUCTURED);
					newNode.setProperty(JcrProp.CONTENT, part);
					JcrUtil.timestampNewNode(session, newNode);

					/*
					 * Because of how 'orderBefore' works (i.e. it 'moves' the bottom node, not the
					 * top node), we always have to continually move the new nodes added into the
					 * location BELOW the node we are splitting, and each time we add a new node it
					 * goes just above this 'nodeBelow' and then in the end everything maintains
					 * proper ordering. Note if 'nodeBelow' is null then that means we are splitting
					 * a node that was already at bottom, so adding all the new nodes as we are here
					 * will make them all end up in the correct locations without us ever calling
					 * 'orderBefore'
					 */
					if (nodeBelow != null) {
						parentNode.orderBefore(newNode.getName(), nodeBelow.getName());
					}
				}
				idx++;
			}

			JcrUtil.save(session);
			res.setSuccess(true);
		}
		catch (Exception ex) {
			throw new RuntimeEx(ex);
		}
	}

	/* Sets the property value of propName to propVal on 'node' and ALL subnodes recursively */
	public void recursiveSetPropertyOnAllNodes(Session session, Node node, String propName, Value val) {
		try {
			QueryManager qm = session.getWorkspace().getQueryManager();

			StringBuilder queryStr = new StringBuilder();
			queryStr.append("SELECT * from [nt:base] AS t WHERE ISDESCENDANTNODE([");
			queryStr.append(node.getPath());
			queryStr.append("])");

			Query q = qm.createQuery(queryStr.toString(), Query.JCR_SQL2);
			QueryResult r = q.execute();
			NodeIterator nodes = r.getNodes();
			while (nodes.hasNext()) {
				Node iterNode = nodes.nextNode();
				iterNode.setProperty(propName, val);
			}
			JcrUtil.save(session);
		}
		catch (Exception ex) {
			throw new RuntimeEx(ex);
		}
	}

}
