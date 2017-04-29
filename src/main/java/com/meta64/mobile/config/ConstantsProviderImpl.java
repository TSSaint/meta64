package com.meta64.mobile.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * I'm using this class to inject strings into the HTML using thymleaf and using properties file as
 * the source of the strings to inject. There is a way to inject directly from a properties file
 * into thymleaf, but it looks more complex and less powerful than this approach. Using the
 * constantsProvider we get access to properties in a way were we can actually process them if we
 * need to before handing them to spring, because we are implementing the getters here.
 */
@Component("constantsProvider")
public class ConstantsProviderImpl implements ConstantsProvider {

	@Autowired
	private AppProp appProp;

	public static String cacheVersion;

	@Override
	public String getHostAndPort() {
		return "http://" + appProp.getMetaHost() + ":" + appProp.getServerPort();
	}

	@Override
	public String getCacheVersion() {
		return cacheVersion;
	}

	@Override
	public String getProfileName() {
		return appProp.getProfileName();
	}

	public static void setCacheVersion(String v) {
		cacheVersion = v;
	}

	@Override
	public String getBrandingMetaContent() {
		return appProp.getBrandingMetaContent();
	}
}
