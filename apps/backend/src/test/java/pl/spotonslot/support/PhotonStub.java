package pl.spotonslot.support;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.core.io.ClassPathResource;

/**
 * Stand-in for the Photon geocoder (the real one is unreachable from CI). By default {@code /api} answers with
 * {@code photon/search-krakow.json} and {@code /reverse} with {@code photon/reverse-krakow.json}; tests can override
 * the answer and must call {@link #reset()} afterwards.
 */
public class PhotonStub implements AutoCloseable {

    private final HttpServer server;
    private final List<URI> requests = new CopyOnWriteArrayList<>();
    private volatile Reply reply;

    public record Reply(int status, String body) {
    }

    public PhotonStub() {
        try {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        server.createContext("/", exchange -> {
            requests.add(exchange.getRequestURI());
            var answer = reply != null ? reply : defaultReply(exchange.getRequestURI().getPath());
            var bytes = answer.body().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(answer.status(), bytes.length);
            try (var body = exchange.getResponseBody()) {
                body.write(bytes);
            }
        });
        server.start();
    }

    public String url() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    public void respondWith(int status, String body) {
        reply = new Reply(status, body);
    }

    public void respondWithFixture(String name) {
        respondWith(200, fixture(name));
    }

    public List<URI> requests() {
        return List.copyOf(requests);
    }

    public void reset() {
        reply = null;
        requests.clear();
    }

    @Override
    public void close() {
        server.stop(0);
    }

    private static Reply defaultReply(String path) {
        return new Reply(200, fixture(path.startsWith("/reverse") ? "reverse-krakow.json" : "search-krakow.json"));
    }

    private static String fixture(String name) {
        try {
            return new ClassPathResource("photon/" + name).getContentAsString(StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
