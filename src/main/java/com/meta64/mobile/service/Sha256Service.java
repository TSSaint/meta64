package com.meta64.mobile.service;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

import javax.jcr.Node;
import javax.jcr.NodeIterator;
import javax.jcr.Property;
import javax.jcr.Session;
import javax.jcr.Value;

import org.apache.commons.codec.binary.Hex;
import org.apache.commons.io.IOUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;

import com.meta64.mobile.config.JcrProp;
import com.meta64.mobile.request.GenerateNodeHashRequest;
import com.meta64.mobile.response.GenerateNodeHashResponse;
import com.meta64.mobile.user.RunAsJcrAdmin;
import com.meta64.mobile.util.ExUtil;
import com.meta64.mobile.util.JcrUtil;
import com.meta64.mobile.util.RuntimeEx;
import com.meta64.mobile.util.StreamUtil;
import com.meta64.mobile.util.ThreadLocals;

/**
 * Generates SHA256 Hash of the given node, recursively including all subnodes. Note: As a prototype
 * bean all the class properties are per-run. Objects of this instance are not reused. This is not a
 * singleton.
 * <p>
 * The current version of this doesn't not store the hash at each node but only the top node being
 * calculated. Need to make this optional. Eventually to be Merkle-like we will store a Hash at ever
 * node on the tree which represents a unique GUID that will change any time that node properties
 * changes or any of the children (recursively deep) have any properties changed.
 * <p>
 * Warning/Caveat: <br>
 * Current implementation stores nodeID+hash in a java HashMap (nodeHashes) in memory list before
 * writing them all out onto each node as a final step which will be done in some kind of delayed
 * writing thread, that saves in batches of 10 or 100 writes at a time likely. This in-memory hash
 * will have to change for large data sets (millions of nodes)
 */
@Component
@Scope("prototype")
public class Sha256Service {
	private static final Logger log = LoggerFactory.getLogger(Sha256Service.class);
	private static final String SHA_ALGO = "SHA-256";

	@Autowired
	private RunAsJcrAdmin adminRunner;

	// private final boolean trace = true;
	// private final StringBuilder traceReport = new StringBuilder();

	private long nodeCount = 0;
	private long binaryCount = 0;
	private long binarySize = 0;
	private long nonBinaryCount = 0;
	private long nonBinarySize = 0;

	/**
	 * For performance, we we use "Linked" hash map to be able to iterate in order, because it
	 * should be true that at the Merkle-write stage these in order will cause more cache-hits
	 * (therefore better performance) when they are written back out to the tree
	 */
	private LinkedHashMap<String, byte[]> nodeIdToHashMap = new LinkedHashMap<String, byte[]>();

	/*
	 * This is the 'full-scan' digester only used when doing a full tree scan in one single shot,
	 * for a full brute-force calculation of a hash of an entire tree branch. This will NOT match
	 * the root has you would get when doing a Merkle-style scan which is eventually what will also
	 * be done in here.
	 * 
	 * todo-0: Once i'm done transitioning to merkle-type hashing i will be able to either not use
	 * this globalDigester at all or else make it optional.
	 */
	// private MessageDigest globalDigester;

	public void generateNodeHash(Session session, GenerateNodeHashRequest req, GenerateNodeHashResponse res) {
		if (session == null) {
			session = ThreadLocals.getJcrSession();
		}

		String nodeId = req.getNodeId();
		boolean success = false;
		try {
			// globalDigester = MessageDigest.getInstance(SHA_ALGO);
			Node node = JcrUtil.findNode(session, nodeId);
			byte[] rootHash = recurseNode(node);

			session.logout();

			writeAllMerkleHashes();

			// log.debug("TRACE: " + traceReport.toString());

			/*
			 * Note: rootHash will be correct even before any nodeIdToHashMap values are written out
			 * onto the tree
			 */

			// byte[] hashBytes = globalDigester.digest();
			String hash = Hex.encodeHexString(rootHash);
			log.debug("Hash=" + hash + "\n   nodeCount=" + nodeCount + "\n   dataPointCount=" + (nonBinaryCount + binaryCount));
			res.setHashInfo(hash);
			success = true;
		}
		catch (Exception ex) {
			throw ExUtil.newEx(ex);
		}

		res.setSuccess(success);
	}

	/*
	 * This is a depth-first recursion, so we hash all the children before we can has the node
	 * itself. Basic Merkle-type algorithm, with the exception that Merkle doesn't normally include
	 * node data in each hash, but we do here. Each recursion returns the hash of the 'node'.
	 */
	private byte[] recurseNode(Node node) {
		if (node == null) return null;
		nodeCount++;

		try {
			MessageDigest digester = MessageDigest.getInstance(SHA_ALGO);

			/* then recursively process all children of the current node */
			NodeIterator nodeIter;
			try {
				nodeIter = JcrUtil.getNodes(node);
			}
			catch (Exception ex) {
				throw ExUtil.newEx(ex);
			}

			try {
				while (true) {
					Node n = nodeIter.nextNode();
					byte[] hashBytes = recurseNode(n);

					/*
					 * Currently since each node doesn't internally store the hashes of all its
					 * children, our live-updating (realtime-updating) of any node will be slow, to
					 * the extent that when a node is rehashed at least its immediate children will
					 * need to be collected and all their hash properties pulled. But i'm leaving
					 * that for later as it is essentially an optimization step.
					 */
					digester.update(hashBytes);
				}
			}
			catch (NoSuchElementException ex) {
				// not an error. Normal iterator end condition.
			}

			/* process the current node */
			processNode(digester, node);

			byte[] hashBytes = digester.digest();

			/*
			 * make sure this ID is unique. JCR should never allow but we still check.
			 * 
			 * todo-0: For mix:referencable nodes this getIdentifier is still a GUID right? Even
			 * with the jcr:uuid value being a standard property value ? I'm 95% sure this is
			 * correct, but I need to run tests to verify.
			 */
			if (nodeIdToHashMap.put(node.getIdentifier(), hashBytes) != null) {
				throw new RuntimeEx("unexpected dupliate identifier encountered: " + node.getIdentifier());
			}
			return hashBytes;
		}
		catch (Exception e) {
			throw ExUtil.newEx(e);
		}
	}

	private void processNode(MessageDigest digester, Node node) {
		try {
			// if (trace) {
			// traceReport.append("Processing Node:\n"); // + node.getIdentifier()+"\n");
			// }

			/* Get ordered set of property names. Ordering is significant for SHA256 obviously */
			List<String> propNames = JcrUtil.getPropertyNames(node, true);
			propNames = removeIgnoredProps(propNames);

			for (String propName : propNames) {
				Property prop = node.getProperty(propName);
				digestProperty(digester, prop);
			}

			updateDigest(digester, "type");
			updateDigest(digester, node.getPrimaryNodeType().getName());
		}
		catch (Exception ex) {
			throw ExUtil.newEx(ex);
		}
	}

	private List<String> removeIgnoredProps(List<String> list) {
		return list.stream().filter(item -> !ignoreProperty(item)).collect(Collectors.toList());
	}

	/*
	 * todo-1: For verification of import/export we need to ignore these, but for DB replication in
	 * P2P we wouldn't. todo-1: need to store these values in a HASH for fast lookup
	 */
	private boolean ignoreProperty(String propName) {
		return JcrProp.CREATED.equals(propName) || //
				JcrProp.LAST_MODIFIED.equals(propName) || //
				JcrProp.CREATED_BY.equals(propName) || //
				JcrProp.UUID.equals(propName) || //
				JcrProp.MERKLE_HASH.equals(propName) || //
				JcrProp.BIN_VER.equals(propName);
	}

	private void digestProperty(MessageDigest digester, Property prop) {
		try {
			updateDigest(digester, prop.getName());
			// if (trace) {
			// traceReport.append(" prop=" + prop.getName() + "\n");
			// }

			/* multivalue */
			if (prop.isMultiple()) {

				for (Value v : prop.getValues()) {
					nonBinaryCount++;
					nonBinarySize += updateDigest(digester, v);
					// if (trace) {
					// traceReport.append(" multiVal=" + v.getString() + "\n");
					// }
				}
			}
			/* else single value */
			else {
				/*
				 * We only support detecting the SubNode app specific binary node property, and so
				 * currently this code will not work as completely general-purpose on any JCR tree
				 * with arbitrary binary nodes.
				 */
				if (prop.getName().equals(JcrProp.BIN_DATA)) {
					binaryCount++;
					long thisBinarySize = updateDigest(digester, prop.getValue().getBinary().getStream());
					binarySize += thisBinarySize;
					// if (trace) {
					// traceReport.append(" binarySize=" + thisBinarySize + "\n");
					// }
				}
				else {
					nonBinaryCount++;
					nonBinarySize += updateDigest(digester, prop.getValue());
					// if (trace) {
					// traceReport.append(" Val=" + prop.getValue().getString() + "\n");
					// }
				}
			}
		}
		catch (Exception ex) {
			throw ExUtil.newEx(ex);
		}
	}

	/*
	 * For now we use a simple 'getString' but in the future we need to get exact binary data so
	 * that even floating point values are seen, not as strings, but arrays of bytes. (todo-0, fix)
	 */
	private byte[] valueToBytes(Value value) {
		try {
			return value.getString().getBytes(StandardCharsets.UTF_8);
		}
		catch (Exception ex) {
			throw ExUtil.newEx(ex);
		}
	}

	/* digest entire stream AND close the stream. */
	private long updateDigest(MessageDigest digester, InputStream inputStream) {
		long dataLen = 0;
		BufferedInputStream bis = null;

		try {
			/* Wrap stream if it's not alrady a buffered one */
			bis = (inputStream instanceof BufferedInputStream) ? (BufferedInputStream)inputStream : new BufferedInputStream(inputStream);
			byte[] bytes = IOUtils.toByteArray(inputStream);
			dataLen = bytes.length;
			updateDigest(digester, bytes);
		}
		catch (IOException ex) {
			throw ExUtil.newEx(ex);
		}
		finally {
			StreamUtil.close(bis);
		}

		return dataLen;
	}

	private long updateDigest(MessageDigest digester, Value v) {
		byte[] bytes = valueToBytes(v);
		updateDigest(digester, bytes);
		return bytes.length;
	}

	private void updateDigest(MessageDigest digester, String val) {
		val = val.trim();
		try {
			updateDigest(digester, val.getBytes(StandardCharsets.UTF_8));
		}
		catch (Exception ex) {
			throw ExUtil.newEx(ex);
		}
	}

	private void updateDigest(MessageDigest digester, byte[] bytes) {
		// globalDigester.update(bytes);
		digester.update(bytes);
	}

	/**
	 * This method will write out all the merkle values calculated for each node ONTO the node. If
	 * this happens to be the first time the Sha256 is run on this node, it will write all the
	 * merkle values, but upon successive processing of the same tree nodes repeatedly, this writes
	 * only the values it needs to write, and for example if the subgraph has not changed at all
	 * then it will not do any writing at all. All Merkle values will end up being the same.
	 * <p>
	 * So interestingly if we wanted to this algorithm is doing a full node-by-node (change
	 * detection since last run) on the tree merely as a nice side-effect. So we can leverage this
	 * in many powerful ways going forward, including things like efficient synchronization of
	 * remote repository subgraphs, etc.
	 */
	private void writeAllMerkleHashes() {
		// todo-0: Once a bit more testing is done, i can boost this batch size to a more reasonable
		// number like 100 or several hundered.
		int maxBatchSize = 10;

		adminRunner.run((Session session) -> {
			try {
				int curBatchSize = 0;
				int batchNumber = 0;
				int identicalCount = 0;
				int changeCount = 0;

				for (Map.Entry<String, byte[]> entry : nodeIdToHashMap.entrySet()) {
					String nodeId = entry.getKey();
					Node node = JcrUtil.findNode(session, nodeId);
					String merkleHash = Hex.encodeHexString(entry.getValue());

					/* get existing merkle hash from node */
					String prevMerkleHash = JcrUtil.safeGetStringProp(node, JcrProp.MERKLE_HASH);

					/*
					 * only write the merkle hash if it's changed (otherwise would have no effect)
					 */
					if (!merkleHash.equals(prevMerkleHash)) {

						/* only attemp to set merkle if node is not repository-controlled */
						if (!JcrUtil.isProtectedNode(node)) {
							changeCount++;
							log.debug("Writing merkle to: " + node.getPath() + " type=" + node.getPrimaryNodeType().getName());
							node.setProperty(JcrProp.MERKLE_HASH, merkleHash);

							if (++curBatchSize >= maxBatchSize) {
								curBatchSize = 0;
								log.debug("Saving Batch " + String.valueOf(++batchNumber));
								session.save();
							}
						}
						else {
							identicalCount++;
						}
					}
					else {
						identicalCount++;
					}
				}

				/* write remainder of last batch */
				if (curBatchSize > 0) {
					curBatchSize = 0;
					log.debug("Saving Batch " + String.valueOf(++batchNumber));
					session.save();
				}

				log.info("All Merkle Hashes successfully written.\n" + //
				"Change count=" + String.valueOf(changeCount) + "\n" + //
				"Identical count=" + String.valueOf(identicalCount));
			}
			catch (Exception ex) {
				throw ExUtil.newEx(ex);
			}
		});
	}
}
