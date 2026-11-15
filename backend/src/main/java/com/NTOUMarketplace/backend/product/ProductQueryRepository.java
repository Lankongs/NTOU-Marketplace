
package com.NTOUMarketplace.backend.product;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Repository;

@Repository
public class ProductQueryRepository {

    private final MongoTemplate mongoTemplate;

    public ProductQueryRepository(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    public List<Product> search(
            String keyword, String type, String tag, String sort) {

        List<Criteria> conditions = new ArrayList<>();

        if (keyword != null) {
            Pattern pattern = Pattern.compile(
                Pattern.quote(keyword),
                Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
            );
            conditions.add(Criteria.where("name").regex(pattern));
        }

        if (type != null) {
            conditions.add(Criteria.where("type").is(type));
        }

        if (tag != null) {
            conditions.add(Criteria.where("tags").is(tag));
        }

        List<AggregationOperation> stages = new ArrayList<>();

        // 先篩選商品
        if (!conditions.isEmpty()) {
            stages.add(Aggregation.match(
                new Criteria().andOperator(
                    conditions.toArray(new Criteria[0])
                )
            ));
        }

        // 依商品類型決定排序價格
        if (sort != null) {
            AggregationOperation addSortPrice = context ->
                new Document("$addFields",
                    new Document("sortPrice",
                        new Document("$cond", List.of(
                            new Document("$eq",
                                List.of("$type", "auction")),
                            new Document("$ifNull",
                                List.of("$currentPrice", "$startPrice")),
                            "$price"
                        ))
                    )
                );

            stages.add(addSortPrice);

            Sort.Direction direction = sort.equals("price_asc")
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;

            stages.add(Aggregation.sort(
                direction, "sortPrice", "_id"
            ));

            // 排序用的暫時欄位不需要回傳前端
            stages.add(context ->
                new Document("$unset", "sortPrice"));
        }

        // 沒有條件時，直接讀取所有商品
        if (stages.isEmpty()) {
            return mongoTemplate.findAll(Product.class);
        }

        Aggregation aggregation = Aggregation.newAggregation(stages);

        return mongoTemplate.aggregate(
            aggregation, "products", Product.class
        ).getMappedResults();
    }
}
