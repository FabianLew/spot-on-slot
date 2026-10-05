package pl.spotonslot.shared.web;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.EnumSet;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.MDC;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

/**
 * Propagates a correlation id: accepts a well-formed {@value #HEADER} from the caller, otherwise generates one, echoes
 * it on the response and exposes it through the {@code requestId} MDC key for logs and error bodies. Runs before the
 * Spring Security filter chain so errors raised inside it carry the id too.
 */
public final class RequestIdFilter implements Filter {

    public static final String HEADER = "X-Request-Id";
    public static final String MDC_KEY = "requestId";

    private static final Pattern VALID = Pattern.compile("^[A-Za-z0-9._-]{1,64}$");
    private static final String ATTRIBUTE = RequestIdFilter.class.getName() + ".ID";

    @Override
    public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse, FilterChain chain)
            throws IOException, ServletException {
        var request = (HttpServletRequest) servletRequest;
        var response = (HttpServletResponse) servletResponse;
        var id = resolveId(request);
        request.setAttribute(ATTRIBUTE, id);
        response.setHeader(HEADER, id);
        MDC.put(MDC_KEY, id);
        try {
            chain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_KEY);
        }
    }

    private static String resolveId(HttpServletRequest request) {
        // Error dispatches re-enter the filter; keep the id chosen for the original request.
        if (request.getAttribute(ATTRIBUTE) instanceof String existing) {
            return existing;
        }
        var incoming = request.getHeader(HEADER);
        return incoming != null && VALID.matcher(incoming).matches() ? incoming : UUID.randomUUID().toString();
    }

    @Configuration(proxyBeanMethods = false)
    static class Registration {

        @Bean
        FilterRegistrationBean<RequestIdFilter> requestIdFilterRegistration() {
            var registration = new FilterRegistrationBean<>(new RequestIdFilter());
            registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
            registration.setDispatcherTypes(EnumSet.of(DispatcherType.REQUEST, DispatcherType.ERROR, DispatcherType.ASYNC));
            return registration;
        }
    }
}
