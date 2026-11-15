
package com.NTOUMarketplace.backend.product;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

@Repository
public class ProductQueryRepository {

    private final MongoTemplate mongoTemplate;

    public ProductQueryRepository(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    public List<Product> search(String keyword, String type, String tag) {
        List<Criteria> conditions = new ArrayList<>();

        if (keyword != null) {
            Pattern namePattern = Pattern.compile(
                Pattern.quote(keyword),
                Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
            );
            conditions.add(Criteria.where("name").regex(namePattern));
        }

        if (type != null) {
            conditions.add(Criteria.where("type").is(type));
        }

        if (tag != null) {
            conditions.add(Criteria.where("tags").is(tag));
        }

        Query query = new Query();

        if (!conditions.isEmpty()) {
            query.addCriteria(
                new Criteria().andOperator(
                    conditions.toArray(new Criteria[0])
                )
            );
        }

        return mongoTemplate.find(query, Product.class);
    }
}
