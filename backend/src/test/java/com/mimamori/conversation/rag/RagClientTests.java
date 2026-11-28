package com.mimamori.conversation.rag;

import com.sun.net.httpserver.HttpServer;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.*;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;

class RagClientTests {
    private HttpServer server;
    private ExecutorService executor;
    private URI uri;
    private static final String TOKEN = "synthetic-internal-test-token-0123456789";
    private String context;
    private String empty;
    @BeforeEach void start() throws Exception {
        context = Files.readString(Path.of("../docs/api/rag-context-example.json"));
        empty = Files.readString(Path.of("../docs/api/rag-no-context-example.json"));
        server = HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        executor = Executors.newCachedThreadPool();
        server.setExecutor(executor);
        server.start();
        uri = URI.create("http://127.0.0.1:"+server.getAddress().getPort());
    }
    @AfterEach void stop() { server.stop(0); executor.shutdownNow(); }
    private RagClient client(Duration timeout, int cap) {
        return new RagClient(new RagProperties(true, uri, TOKEN, timeout, Duration.ofMillis(100), cap, 1));
    }
    private void reply(int status, String body) {
        server.createContext("/internal/v1/retrievals", exchange -> {
            exchange.getRequestBody().readAllBytes();
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type","application/json");
            exchange.sendResponseHeaders(status,bytes.length);
            exchange.getResponseBody().write(bytes); exchange.close();
        });
    }
    @Test void sharedContractAndInternalHeaders() throws Exception {
        var calls = new AtomicInteger();
        server.createContext("/internal/v1/retrievals", exchange -> {
            assertEquals("POST",exchange.getRequestMethod());
            assertNull(exchange.getRequestHeaders().getFirst("Upgrade"));
            assertEquals(TOKEN,exchange.getRequestHeaders().getFirst("X-Internal-Token"));
            var body=new JsonMapper().readTree(exchange.getRequestBody().readAllBytes());
            assertEquals("vi",body.path("language").asText());
            assertEquals(3,body.path("top_k").asInt());
            assertEquals(384,body.path("max_context_tokens").asInt());
            calls.incrementAndGet();
            byte[] bytes=context.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200,bytes.length);
            exchange.getResponseBody().write(bytes);exchange.close();
        });
        var client=client(Duration.ofSeconds(3),65536);
        try {
            var result=client.retrieve(RagRequest.of("synthetic question","vi"));
            assertTrue(result.hasContext());
            assertEquals("synthetic-fixture",result.chunks().getFirst().sourceId());
            assertEquals(1,calls.get());
            assertFalse(RagRequest.of("private query","vi").toString().contains("private"));
        } finally { client.close(); }
    }
    @Test void explicitNoContext() {
        reply(200,empty);
        var client=client(Duration.ofSeconds(3),65536);
        try { assertEquals("NO_MATCH",client.retrieve(RagRequest.of("q","vi")).reason()); }
        finally { client.close(); }
    }
    @Test void invalidInputAndDisabledConfigurationDoNotConnect() {
        new ApplicationContextRunner().withUserConfiguration(RagClient.class).run(context -> {
            assertNull(context.getStartupFailure());
            assertEquals("DISABLED",context.getBean(RagClient.class).retrieve(RagRequest.of("q","ja")).reason());
        });
        var client=client(Duration.ofSeconds(1),65536);
        try {
            assertEquals("INVALID_REQUEST",client.retrieve(RagRequest.of("q","en")).reason());
            assertEquals("INVALID_REQUEST",client.retrieve(new RagRequest("q","vi",9,384,List.of(),List.of())).reason());
        } finally { client.close(); }
    }
    @Test void remoteFailureAndOversizeAreSafe() {
        reply(503,"private-upstream-detail");
        var client=client(Duration.ofSeconds(1),1024);
        try { assertEquals("UNAVAILABLE",client.retrieve(RagRequest.of("q","vi")).reason()); }
        finally { client.close(); }
        server.removeContext("/internal/v1/retrievals");
        reply(200,"x".repeat(50000));
        client=client(Duration.ofSeconds(1),1024);
        try { assertFalse(client.retrieve(RagRequest.of("q","vi")).hasContext()); }
        finally { client.close(); }
    }
    @Test void malformedAndUntrustedContractAreRejected() {
        for(String body:List.of("not json",context.replace("\"vi\"","\"ja\""),
                context.replace("\"context_tokens\": 8","\"context_tokens\": 999"),
                context.replace("repo://mimamori/synthetic.md","https://user:password@example.invalid/x"),
                context.replace("\"schema_version\": 1","\"schema_version\": 2"))) {
            reply(200,body);
            var client=client(Duration.ofSeconds(2),65536);
            try { assertEquals("INVALID_RESPONSE",client.retrieve(RagRequest.of("q","vi")).reason()); }
            finally { client.close(); server.removeContext("/internal/v1/retrievals"); }
        }
    }
    @Test void slowResponseBodyHasTotalDeadlineAndConcurrencyCap() throws Exception {
        var entered=new CountDownLatch(1);
        var release=new CountDownLatch(1);
        server.createContext("/internal/v1/retrievals",exchange -> {
            exchange.sendResponseHeaders(200,0);
            exchange.getResponseBody().write('{');exchange.getResponseBody().flush();
            entered.countDown();
            try { release.await(5,TimeUnit.SECONDS); } catch(InterruptedException error) { Thread.currentThread().interrupt(); }
            exchange.close();
        });
        var client=client(Duration.ofMillis(700),65536);
        var pool=Executors.newSingleThreadExecutor();
        long started=System.nanoTime();
        try {
            var pending=pool.submit(()->client.retrieve(RagRequest.of("q","vi")));
            assertTrue(entered.await(3,TimeUnit.SECONDS));
            assertEquals("BUSY",client.retrieve(RagRequest.of("q","vi")).reason());
            assertFalse(pending.get(3,TimeUnit.SECONDS).hasContext());
            assertTrue(Duration.ofNanos(System.nanoTime()-started).toMillis()<3000);
        } finally { release.countDown(); pool.shutdownNow(); client.close(); }
    }
}
