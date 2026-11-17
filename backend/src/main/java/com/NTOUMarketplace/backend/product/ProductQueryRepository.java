
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
            String keyword, String type, String tag, String sort, String status) {

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



        if (status == null) {
            // 一般商品列表：不顯示已下架商品
            conditions.add(Criteria.where("status").ne("delisted"));
        } else if (status.equals("selling")) {
            // 舊商品沒有 status 欄位時，暫時視為販售中
            conditions.add(new Criteria().orOperator(
                Criteria.where("status").is("selling"),
                Criteria.where("status").exists(false),
                Criteria.where("status").is(null)
            ));
        } else if (status.equals("sold")) {
            conditions.add(Criteria.where("status").is("sold"));
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

        Aggregation aggregation = Aggregation.newAggregation(stages);

        return mongoTemplate.aggregate(
            aggregation, "products", Product.class
        ).getMappedResults();
    }
}
