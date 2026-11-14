package com.NTOUMarketplace.backend.auth;

import static org.junit.jupiter.api.Assertions.*;
import com.NTOUMarketplace.backend.MongoIntegrationTest;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;

@SpringBootTest
class MemberRepositoryTests extends MongoIntegrationTest {
    @Autowired MemberRepository members;
    @Autowired MongoTemplate mongo;

    @Test void literalLookupAndDuplicateAccountProtection() {
        members.create("literal", "會員", "$2a$existing-hash");
        var member = members.find("literal").orElseThrow();
        assertTrue(member.id() > 0);
        assertEquals("會員", member.displayName());
        assertEquals("$2a$existing-hash", member.passwordHash());
        assertTrue(members.find("{\"$ne\":null}").isEmpty());
        assertTrue(members.find("LITERAL").isEmpty()); // normalization remains in AuthController
        assertThrows(DuplicateKeyException.class, () -> members.create("literal", "other", "hash"));
        assertEquals(member, members.find("literal").orElseThrow());
    }

    @Test void concurrentCreatesHaveDistinctNumericIds() throws Exception {
        var executor = Executors.newFixedThreadPool(8);
        try {
            var tasks = new ArrayList<Callable<Long>>();
            for (int i = 0; i < 32; i++) {
                final String account = "parallel-" + i;
                tasks.add(() -> { members.create(account, account, "hash"); return members.find(account).orElseThrow().id(); });
            }
            var ids = new HashSet<Long>();
            for (var result : executor.invokeAll(tasks)) assertTrue(ids.add(result.get()));
            assertEquals(32, ids.size());
        } finally { executor.shutdownNow(); }
    }

    @Test void concurrentDuplicateAccountsCannotOverwriteTheWinner() throws Exception {
        var executor = Executors.newFixedThreadPool(8);
        try {
            var tasks = new ArrayList<Callable<Boolean>>();
            for (int i = 0; i < 16; i++) {
                tasks.add(() -> {
                    try { members.create("same-account", "name", "hash"); return true; }
                    catch (DuplicateKeyException expected) { return false; }
                });
            }
            int created = 0;
            for (var result : executor.invokeAll(tasks)) if (result.get()) created++;
            assertEquals(1, created);
            assertEquals("hash", members.find("same-account").orElseThrow().passwordHash());
        } finally { executor.shutdownNow(); }
    }

    @Test void importedIdAndHashSurviveAndCounterContinues() {
        mongo.getCollection("members").insertOne(new Document("_id", 5000L)
            .append("account", "imported").append("displayName", "舊會員").append("passwordHash", "$2a$preserved"));
        mongo.getCollection("counters").updateOne(new Document("_id", "members"),
            new Document("$max", new Document("value", 5000L)), new com.mongodb.client.model.UpdateOptions().upsert(true));
        assertEquals(5000L, members.find("imported").orElseThrow().id());
        assertEquals("$2a$preserved", members.find("imported").orElseThrow().passwordHash());
        members.create("after-import", "New member", "hash");
        assertTrue(members.find("after-import").orElseThrow().id() > 5000L);
    }
}
