package com.meta64.mobile.lucene;

import java.io.File;
import java.io.IOException;
import java.util.LinkedList;
import java.util.List;

import javax.annotation.PreDestroy;

import org.apache.commons.lang3.StringUtils;
import org.apache.lucene.analysis.standard.StandardAnalyzer;
import org.apache.lucene.document.Document;
import org.apache.lucene.index.DirectoryReader;
import org.apache.lucene.index.IndexWriterConfig;
import org.apache.lucene.index.Term;
import org.apache.lucene.queryparser.classic.QueryParser;
import org.apache.lucene.search.BooleanClause.Occur;
import org.apache.lucene.search.BooleanQuery;
import org.apache.lucene.search.IndexSearcher;
import org.apache.lucene.search.Query;
import org.apache.lucene.search.ScoreDoc;
import org.apache.lucene.search.TermQuery;
import org.apache.lucene.search.TopDocs;
import org.apache.lucene.store.FSDirectory;
import org.apache.lucene.util.Version;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.meta64.mobile.model.FileSearchResult;

/* 
 * Take another look at synchornized blocks in this code. I'm troubleshooting and putting in temporary sync code right now.
 */
@Component
public class FileSearcher {
	private static final Logger log = LoggerFactory.getLogger(FileSearcher.class);

	/** lucene version */
	private static final Version VERSION = Version.LUCENE_47;
	
	private FSDirectory fsDir;
	private DirectoryReader reader;
	private IndexSearcher searcher;
	
	public static final IndexWriterConfig config = new IndexWriterConfig(VERSION, new StandardAnalyzer(VERSION));

	private static final QueryParser parser = new QueryParser(VERSION, "contents", new StandardAnalyzer(VERSION));

	/** lucene directory */
	@Value("${lucene.index.dir}")
	private String luceneDir;
	
	public boolean initialized = false;

	private synchronized void init() throws Exception {
		if (initialized) return;
		initialized = true;
		
		if (StringUtils.isEmpty(luceneDir)) {
			throw new Exception("Lucend Data Dir is not configured.");
		}
		
		fsDir = FSDirectory.open(new File(luceneDir));
		reader = DirectoryReader.open(fsDir);
		searcher = new IndexSearcher(reader);
		if (searcher!=null) {
			log.debug("Searcher is created ok.");
		}
	}

	public synchronized Document findByFileName(String filePath) throws Exception {
		init();
		BooleanQuery matchingQuery = new BooleanQuery();

		// todo-0: do we really need the 'SHOULD' there. Is that simplest way ?
		matchingQuery.add(new TermQuery(new Term("filepath", filePath)), Occur.SHOULD);
		TopDocs topDocs = searcher.search(matchingQuery, 1);

		if (topDocs.totalHits > 0) {
			for (final ScoreDoc d : topDocs.scoreDocs) {
				Document doc = searcher.doc(d.doc);
				return doc;
			}
		}
		return null;
	}

	/**
	 * Search the index for given query and return only specified hits.
	 */
	public synchronized List<FileSearchResult> search(final String queryStr, final int maxHits) throws Exception {
		init();
		final long now = System.currentTimeMillis();

		List<FileSearchResult> results = new LinkedList<FileSearchResult>();
		final Query query = parser.parse(queryStr);
		final ScoreDoc[] hits = searcher.search(query, null, maxHits).scoreDocs;

		log.info("Search took {} milli seconds...found {} documents matching the query: {}", System.currentTimeMillis() - now, hits.length, queryStr);
		
		if (hits.length > 0) {
			for (final ScoreDoc d : hits) {
				Document doc = searcher.doc(d.doc);
				FileSearchResult fsr = new FileSearchResult();
				fsr.setFileName(doc.get("filepath"));
				results.add(fsr);
			}
		}
		
		return results;
	}


	@PreDestroy
	public synchronized void close() {
		closeIndexReader();
		closeFSDirectory();
	}

	private void closeIndexReader() {
		if (reader != null) {
			log.info("closing lucene index reader");
			try {
				reader.close();
				reader = null;
			}
			catch (final IOException e) {
				throw new RuntimeException(e);
			}
		}
	}

	private void closeFSDirectory() {
		if (fsDir != null) {
			log.info("closing FSDirectory");
			fsDir.close();
			fsDir = null;
		}
	}
}
