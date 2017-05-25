package com.meta64.mobile.util;

import java.util.Collections;
import java.util.LinkedList;
import java.util.List;

import javax.jcr.Node;
import javax.jcr.Property;
import javax.jcr.PropertyIterator;
import javax.jcr.PropertyType;
import javax.jcr.Session;
import javax.jcr.Value;
import javax.jcr.nodetype.NodeType;
import javax.jcr.security.AccessControlEntry;
import javax.jcr.security.Privilege;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.meta64.mobile.config.JcrProp;
import com.meta64.mobile.config.SessionContext;
import com.meta64.mobile.image.ImageSize;
import com.meta64.mobile.image.ImageUtil;
import com.meta64.mobile.model.AccessControlEntryInfo;
import com.meta64.mobile.model.NodeInfo;
import com.meta64.mobile.model.PrivilegeInfo;
import com.meta64.mobile.model.PropertyInfo;
import com.meta64.mobile.model.UserPreferences;

/**
 * Converting objects from one type to another, and formatting.
 */
@Component
public class Convert {

	/*
	 * We have to use full annotation here because we already have a different Value class in the
	 * imports section
	 */
	@org.springframework.beans.factory.annotation.Value("${donateButton}")
	private String donateButton;

	public static final PropertyInfoComparator propertyInfoComparator = new PropertyInfoComparator();

	private static final Logger log = LoggerFactory.getLogger(Convert.class);

	public static String JsonStringify(Object obj) {
		/*
		 * I haven't investigated the overhead of creating an ObjectMapper here, instead of using an
		 * already created one or pooling pattern for them, but I do know they aren't threadsafe, so
		 * just using a global one would not be good.
		 */
		ObjectMapper mapper = new ObjectMapper();
		mapper.configure(SerializationFeature.FAIL_ON_EMPTY_BEANS, false);
		try {
			return mapper.writeValueAsString(obj);
		}
		catch (JsonProcessingException e) {
			throw ExUtil.newEx(e);
		}
	}

	public static List<AccessControlEntryInfo> convertToAclListInfo(AccessControlEntry[] aclEntries) {
		List<AccessControlEntryInfo> aclEntriesInfo = new LinkedList<AccessControlEntryInfo>();

		if (aclEntries != null) {
			for (AccessControlEntry ace : aclEntries) {
				AccessControlEntryInfo aceInfo = new AccessControlEntryInfo();
				aceInfo.setPrincipalName(ace.getPrincipal().getName());

				List<PrivilegeInfo> privInfoList = new LinkedList<PrivilegeInfo>();
				for (Privilege privilege : ace.getPrivileges()) {

					PrivilegeInfo privInfo = new PrivilegeInfo();
					privInfo.setPrivilegeName(privilege.getName());
					privInfoList.add(privInfo);
				}

				aceInfo.setPrivileges(privInfoList);
				aclEntriesInfo.add(aceInfo);
			}
		}

		return aclEntriesInfo;
	}

	/*
	 * WARNING: skips the check for ordered children and just assigns false for performance reasons
	 */
	public NodeInfo convertToNodeInfo(SessionContext sessionContext, Session session, Node node, boolean htmlOnly, boolean allowAbbreviated, boolean initNodeEdit) {
		boolean hasBinary = false;
		boolean binaryIsImage = false;
		ImageSize imageSize = null;

		long binVer = getBinaryVersion(node);
		if (binVer > 0) {
			/* if we didn't get an exception, we know we have a binary */
			hasBinary = true;
			binaryIsImage = isImageAttached(node);

			if (binaryIsImage) {
				imageSize = getImageSize(node);
			}
		}

		UserPreferences userPreferences = sessionContext.getUserPreferences();
		boolean advancedMode = userPreferences != null ? userPreferences.isAdvancedMode() : false;
		boolean hasNodes = JcrUtil.hasDisplayableNodes(advancedMode, node);
		// log.trace("hasNodes=" + hasNodes + " path=" + node.getPath());

		List<PropertyInfo> propList = buildPropertyInfoList(sessionContext, node, htmlOnly, allowAbbreviated, initNodeEdit);

		NodeType nodeType = JcrUtil.safeGetPrimaryNodeType(node);
		String primaryTypeName = nodeType == null ? "n/a" : nodeType.getName();
		/*
		 * log.debug("convertNodeInfo: " + node.getPath() + node.getName() + " type: " +
		 * primaryTypeName + " hasBinary=" + hasBinary);
		 */

		try {
			NodeInfo nodeInfo = new NodeInfo(node.getIdentifier(), node.getPath(), node.getName(), propList, hasNodes, false, hasBinary, binaryIsImage, binVer, //
					imageSize != null ? imageSize.getWidth() : 0, //
					imageSize != null ? imageSize.getHeight() : 0, //
					primaryTypeName);
			return nodeInfo;
		}
		catch (Exception ex) {
			throw ExUtil.newEx(ex);
		}
	}

	public static long getBinaryVersion(Node node) {
		try {
			Property versionProperty = node.getProperty(JcrProp.BIN_VER);
			if (versionProperty != null) {
				return versionProperty.getValue().getLong();
			}
		}
		catch (Exception e) {
			// if we catch this exception here it's perfectly normal and just means this node has no
			// binary attachment.
		}
		return 0;
	}

	public static ImageSize getImageSize(Node node) {
		try {
			ImageSize imageSize = new ImageSize();

			Property widthProperty = node.getProperty(JcrProp.IMG_WIDTH);
			if (widthProperty != null) {
				imageSize.setWidth((int) widthProperty.getValue().getLong());
			}

			Property heightProperty = node.getProperty(JcrProp.IMG_HEIGHT);
			if (heightProperty != null) {
				imageSize.setHeight((int) heightProperty.getValue().getLong());
			}
			return imageSize;
		}
		catch (Exception ex) {
			throw ExUtil.newEx(ex);
		}
	}

	public static boolean isImageAttached(Node node) {
		try {
			Property mimeTypeProp = node.getProperty(JcrProp.BIN_MIME);
			return (mimeTypeProp != null && //
					mimeTypeProp.getValue() != null && //
					ImageUtil.isImageMime(mimeTypeProp.getValue().getString()));
		}
		catch (Exception ex) {
			throw ExUtil.newEx(ex);
		}
	}

	public List<PropertyInfo> buildPropertyInfoList(SessionContext sessionContext, Node node, //
			boolean htmlOnly, boolean allowAbbreviated, boolean initNodeEdit) {
		try {
			List<PropertyInfo> props = null;
			PropertyIterator propsIter = node.getProperties();
			PropertyInfo contentPropInfo = null;

			while (propsIter.hasNext()) {
				/* lazy create props */
				if (props == null) {
					props = new LinkedList<PropertyInfo>();
				}
				Property p = propsIter.nextProperty();

				PropertyInfo propInfo = convertToPropertyInfo(sessionContext, node, p, htmlOnly, allowAbbreviated, initNodeEdit);
				// log.debug(" PROP Name: " + p.getName());

				/*
				 * grab the content property, and don't put it in the return list YET, because we
				 * will be sorting the list and THEN putting the content at the top of that sorted
				 * list.
				 */
				if (p.getName().equals(JcrProp.CONTENT)) {
					contentPropInfo = propInfo;
				}
				else {
					props.add(propInfo);
				}
			}

			if (props != null) {
				Collections.sort(props, propertyInfoComparator);

				/* put content prop always at top of list */
				if (contentPropInfo != null) {
					props.add(0, contentPropInfo);
				}
			}
			return props;
		}
		catch (Exception ex) {
			throw ExUtil.newEx(ex);
		}
	}

	public PropertyInfo convertToPropertyInfo(SessionContext sessionContext, Node node, Property prop, boolean htmlOnly, boolean allowAbbreviated, boolean initNodeEdit) {
		try {
			String value = null;
			boolean abbreviated = false;
			List<String> values = null;

			/* multivalue */
			if (prop.isMultiple()) {
				// log.trace(String.format("prop[%s] isMultiple", prop.getName()));
				values = new LinkedList<String>();

				// int valIdx = 0;
				for (Value v : prop.getValues()) {
					String strVal = formatValue(sessionContext, v, false, initNodeEdit);
					// log.trace(String.format(" val[%d]=%s", valIdx, strVal));
					values.add(strVal);
					// valIdx++;
				}
			}
			/* else single value */
			else {
				if (prop.getName().equals(JcrProp.BIN_DATA)) {
					// log.trace(String.format("prop[%s] isBinary", prop.getName()));
					value = "[binary data]";
				}
				else if (prop.getName().equals(JcrProp.CONTENT)) {
					value = formatValue(sessionContext, prop.getValue(), htmlOnly, initNodeEdit);
					/* log.trace(String.format("prop[%s]=%s", prop.getName(), value)); */
				}
				else {
					value = formatValue(sessionContext, prop.getValue(), false, initNodeEdit);
					/* log.trace(String.format("prop[%s]=%s", prop.getName(), value)); */
				}
			}
			PropertyInfo propInfo = new PropertyInfo(prop.getType(), prop.getName(), value, abbreviated, values);
			return propInfo;
		}
		catch (Exception ex) {
			throw ExUtil.newEx(ex);
		}
	}

	public String buildMoreLink(Node node) {
		try {
			StringBuilder sb = new StringBuilder();
			sb.append("<a class=\"moreLinkStyle\" onclick=\"meta64.modRun('Nav', function(m){m.nav.expandMore('" + node.getIdentifier() + "');});\">[more]</a>");
			return sb.toString();
		}
		catch (Exception ex) {
			throw ExUtil.newEx(ex);
		}
	}

	public String basicTextFormatting(String val) {
		val = val.replace("\n\r", "<p>");
		val = val.replace("\n", "<p>");
		val = val.replace("\r", "<p>");
		return val;
	}

	public String formatValue(SessionContext sessionContext, Value value, boolean convertToHtml, boolean initNodeEdit) {
		try {
			if (value.getType() == PropertyType.DATE) {
				return sessionContext.formatTime(value.getDate().getTime());
			}
			else {
				String ret = value.getString();

				/*
				 * If we are doing an initNodeEdit we don't do this, because we want the text to
				 * render to the user exactly as they had typed it and not with links converted.
				 */
				if (!initNodeEdit) {
					ret = convertLinksToMarkdown(ret);
				}

				// may need to revisit this (todo-2)
				// ret = finalTagReplace(ret);
				// ret = basicTextFormatting(ret);

				return ret;
			}
		}
		catch (Exception e) {
			return "";
		}
	}

	/**
	 * Searches in 'val' anywhere there is a line that begins with http:// (or https), and replaces
	 * that with the normal way of doing a link in markdown. So we are injecting a snippet of
	 * markdown (not html)
	 * 
	 * todo-1: i noticed this method gets called during the 'saveNode' processing and then is called
	 * again when the server refreshes the whole page. This is something that is a slight bit of
	 * wasted processing.
	 */
	public static String convertLinksToMarkdown(String val) {
		while (true) {
			/* find http after newline character */
			int startOfLink = val.indexOf("\nhttp://");

			/* or else find one after return char */
			if (startOfLink == -1) {
				startOfLink = val.indexOf("\rhttp://");
			}

			/* or else find one after return char */
			if (startOfLink == -1) {
				startOfLink = val.indexOf("\nhttps://");
			}

			/* or else find one after return char */
			if (startOfLink == -1) {
				startOfLink = val.indexOf("\rhttps://");
			}

			/* nothing found we're all done here */
			if (startOfLink == -1) break;

			/*
			 * locate end of link via \n or \r
			 */
			int endOfLink = val.indexOf("\n", startOfLink + 1);
			if (endOfLink == -1) {
				endOfLink = val.indexOf("\r", startOfLink + 1);
			}
			if (endOfLink == -1) {
				endOfLink = val.length();
			}

			String link = val.substring(startOfLink + 1, endOfLink);

			String left = val.substring(0, startOfLink + 1);
			String right = val.substring(endOfLink);
			val = left + "[" + link + "](" + link + ")" + right;
		}
		return val;
	}

	public static String finalTagReplace(String val) {
		val = val.replace("[pre]<p></p>", "<pre class='customPre'>");
		val = val.replace("[pre]<p>", "<pre class='customPre'>");
		val = val.replace("[pre]", "<pre class='customPre'>");
		val = val.replace("[/pre]", "</pre>");
		return val;
	}
}
