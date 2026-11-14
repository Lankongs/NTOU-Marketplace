package com.NTOUMarketplace.backend;

import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/** Real MongoDB, isolated from development/demo data and other test runs. */
@org.springframework.test.annotation.DirtiesContext(classMode = org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
public abstract class MongoIntegrationTest {
    private static final String DATABASE = "ntou_test_" + UUID.randomUUID().toString().replace("-", "");
    @DynamicPropertySource
    static void mongodb(DynamicPropertyRegistry properties) {
        properties.add("spring.mongodb.uri", () -> System.getenv().getOrDefault(
            "TEST_MONGODB_URI", "mongodb://127.0.0.1:27017"));
        properties.add("spring.mongodb.database", () -> DATABASE);
    }
    @AfterAll
    static void cleanup(@Autowired MongoTemplate mongo) {
        if (!DATABASE.equals(mongo.getDb().getName())) throw new IllegalStateException("Unexpected test database");
        mongo.getDb().drop();
    }
}
