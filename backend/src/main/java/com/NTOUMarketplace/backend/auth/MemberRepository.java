package com.NTOUMarketplace.backend.auth;

import java.util.Optional;
import jakarta.annotation.PostConstruct;
import org.bson.Document;
import com.mongodb.client.model.FindOneAndUpdateOptions;
import com.mongodb.client.model.ReturnDocument;
import org.springframework.data.annotation.Id;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

@Repository
public class MemberRepository {
    private final MongoTemplate mongo;
    public MemberRepository(MongoTemplate mongo) { this.mongo = mongo; }

    @org.springframework.data.mongodb.core.mapping.Document(collection = "members")
    public record Member(@Id long id, String account, String displayName, String passwordHash) {}

    @PostConstruct
    void ensureIndexes() {
        // Fail startup if existing data violates the same uniqueness constraint as H2.
        mongo.indexOps(Member.class).createIndex(new Index().on("account", Sort.Direction.ASC)
            .unique().named("members_account_unique"));
    }

    public Optional<Member> find(String account) {
        // The supplied account is a literal value, never parsed as a MongoDB query.
        return Optional.ofNullable(mongo.findOne(Query.query(Criteria.where("account").is(account)), Member.class));
    }

    public void create(String account, String name, String hash) {
        if (account == null || name == null || hash == null
                || account.length() > 100 || name.length() > 100 || hash.length() > 100) {
            throw new IllegalArgumentException("Member fields must be non-null and at most 100 characters");
        }
        mongo.insert(new Member(nextId(), account, name, hash));
    }

    private long nextId() {
        // Atomic across processes. Gaps after failed inserts are intentional, as with SQL identities.
        var counters = mongo.getCollection("counters");
        var options = new FindOneAndUpdateOptions().upsert(true).returnDocument(ReturnDocument.AFTER);
        Document counter;
        try {
            counter = counters.findOneAndUpdate(new Document("_id", "members"),
                new Document("$inc", new Document("value", 1L)), options);
        } catch (com.mongodb.MongoException ex) {
            // Two processes may race to create the first counter document.
            if (ex.getCode() != 11000) throw ex;
            counter = counters.findOneAndUpdate(new Document("_id", "members"),
                new Document("$inc", new Document("value", 1L)), options);
        }
        return ((Number) counter.get("value")).longValue();
    }
}
