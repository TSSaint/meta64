package com.meta64.mobile;

import java.io.IOException;
import java.io.PrintWriter;
import java.nio.charset.Charset;

import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.annotation.WebFilter;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;

import com.meta64.mobile.config.ConstantsProvider;
import com.meta64.mobile.config.ConstantsProviderImpl;

/*
 * This WebFilter is capable of logging all URL requests, but the primary purpose is to eliminate any need for something like
 * JSPs or Thymeleaf, by providing all we need in this app which the ability to substitute strings into the HTML 
 * at runtime, which is done in the 'transform' method.
 */
@WebFilter(urlPatterns = { "/*" }, filterName = "AppFilter", description = "Meta64 App Filter")
public class AppFilter implements Filter {
	private static final Logger log = LoggerFactory.getLogger(AppFilter.class);
	private FilterConfig config = null;

	private static boolean useWriter = false;

	@Autowired
	private ConstantsProvider constProvider;

	/*
	 * Each time the server restarts we have a new version number here and will
	 * cause clients to download new version of JS files into their local
	 * browser cache. For now the assumption is that this is better then having
	 * to remember to update version numbers to invalidate client caches, but in
	 * production systems we may not want to push new JS just because of a
	 * server restart so this will change in the future. That is, the
	 * 'currentTimeMillis' part will change to some kind of an actual version
	 * number or something, that will be part of managed releases.
	 */
	public static final long cacheVersion = System.currentTimeMillis();
	public static final String cacheVersionStr;

	static {
		cacheVersionStr = String.valueOf(cacheVersion);
	}

	public static final long cssVersion = cacheVersion; // match jsVersion for
														// now,
														// why not.

	/*
	 * This is an acceptable hack to reference the Impl class directly like
	 * this.
	 */
	static {
		ConstantsProviderImpl.setCacheVersion(String.valueOf(cacheVersion));
	}

	@Value("${jqueryJs}")
	private String jqueryJs;

	@Value("${brandingTitle}")
	private String brandingTitle;

	@Value("${brandingMetaContent}")
	private String brandingMetaContent;

	public void init(FilterConfig config) throws ServletException {
		this.config = config;
	}

	public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
			throws ServletException, IOException {

		HttpServletRequest request = (HttpServletRequest) req;
		HttpServletResponse response = (HttpServletResponse) res;

		String uri = request.getRequestURI();

		/*
		 * I realize I could be using the filter pattern matcher to do a lot of
		 * this URI searching, but this filter also does loging of all requests,
		 * so we need this filter to intercept everything.
		 */
		if (!uri.contains("/bower_components/") && //
				!uri.contains("/cookie/") && //
				!uri.contains("/jquery/")) {
			String ver = request.getParameter("ver");
			String warning = "";
			if (ver == null) {
				ver = "";
				warning = "WARNING: NO VERSION!!!";
			}
			log.debug(warning + " FILTER: " + uri + "[ver=" + ver + "]");

			if (uri.equals("/") || //
					uri.equals("/twitterAuth") || //
					uri.toLowerCase().contains(".html")) {
				transform(req, res, chain);
				return;
			}
		}

		chain.doFilter(req, res);
	}

	public void transform(ServletRequest req, ServletResponse res, FilterChain chain)
			throws ServletException, IOException {

		CharResponseWrapper wrapper = new CharResponseWrapper((HttpServletResponse) res);
		chain.doFilter(req, wrapper);
		String content = wrapper.toString();

		content = content.replace("{{cacheVersion}}", cacheVersionStr);
		content = content.replace("{{jqueryJs}}", jqueryJs);
		content = content.replace("{{brandingTitle}}", brandingTitle);
		content = content.replace("{{brandingMetaContent}}", brandingMetaContent);
		content = content.replace("{{cookiePrefix}}", constProvider.getCookiePrefix());
		content = content.replace("{{profileName}}", constProvider.getProfileName());

		/*
		 * WARNING: DO NOT REMOVE WRITER.
		 * 
		 * Servlets allow any given request to either call getWriter(), or
		 * getOutputStream(), but once you call one of them on a given request
		 * you are not allowed to call the other. So depending on the Web
		 * Framework you are in (JSPs, etc) that will determine which you need
		 * to go with. For SpringMVC it appears the getOutputStream() is the way
		 * to go. But to keep this code flexible for future use leave the
		 * getWriter() stuff here but commented out.
		 */
		if (useWriter) {
			PrintWriter out = res.getWriter();
			out.write(content);
			out.close();
		} else {
			res.getOutputStream().write(content.getBytes(Charset.forName("UTF-8")));
		}
	}

	public void destroy() {
	}
}
