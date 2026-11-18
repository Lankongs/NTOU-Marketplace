
package com.NTOUMarketplace.backend.product;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final ProductQueryRepository queryRepository;
    private final MongoTemplate mongoTemplate;

    public ProductService(
        ProductRepository productRepository,
        ProductQueryRepository queryRepository,
        MongoTemplate mongoTemplate) {

    this.productRepository = productRepository;
    this.queryRepository = queryRepository;
    this.mongoTemplate = mongoTemplate;
    }

    public List<Product> getProductsBySellerId(Long sellerId) {
        return productRepository.findBySellerId(sellerId);
    }

    public List<Product> getAllProducts() {
        return queryRepository.search(null, null, null, null, null);
    }

    public List<Product> searchProducts(String keyword) {
        return searchProducts(keyword, null, null, null, null);
    }

    public List<Product> searchProducts(
            String keyword, String type, String tag, String sort, String status) {

        keyword = normalize(keyword);
        type = normalize(type);
        tag = normalize(tag);
        sort = normalize(sort);
        status = normalize(status);

        if (type != null
                && !type.equals("direct")
                && !type.equals("auction")) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "type 必須是 direct 或 auction"
            );
        }

        if (sort != null
                && !sort.equals("price_asc")
                && !sort.equals("price_desc")) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "sort 必須是 price_asc 或 price_desc"
            );
        }

        if ("delisted".equals(status)) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "已下架商品只能透過賣家商品管理 API 查詢"
            );
        }

        if (status != null
                && !status.equals("selling")
                && !status.equals("sold")) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "status 必須是 selling 或 sold"
            );
        }

        return queryRepository.search(keyword, type, tag, sort, status);
    }

    public Product changeStatus(
            String productId,
            Long sellerId,
            String expectedStatus,
            String newStatus) {

        // 只允許下架與重新上架兩種操作
        boolean delist = expectedStatus.equals("selling")
                && newStatus.equals("delisted");

        boolean relist = expectedStatus.equals("delisted")
                && newStatus.equals("selling");

        if (!delist && !relist) {
            throw new IllegalArgumentException("不允許的商品狀態轉換");
        }

        // 同時檢查商品 ID、賣家 ID、目前狀態
        Query query = Query.query(
            Criteria.where("_id").is(productId)
                .and("sellerId").is(sellerId)
                .and("status").is(expectedStatus)
        );

        Update update = new Update()
            .set("status", newStatus);

        // 條件符合才更新，並取得更新後的商品
        Product updated = mongoTemplate.findAndModify(
            query,
            update,
            FindAndModifyOptions.options().returnNew(true),
            Product.class
        );

        if (updated != null) {
            return updated;
        }

        // 更新失敗，進一步判斷原因
        Product product = productRepository.findById(productId)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "找不到商品"
            ));

        // 沒有 sellerId 的舊商品也不能任意操作
        if (product.getSellerId() == null
                || !product.getSellerId().equals(sellerId)) {
            throw new ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "你沒有權限修改這項商品"
            );
        }

        // 商品存在、擁有者正確，但目前狀態不允許操作
        throw new ResponseStatusException(
            HttpStatus.CONFLICT,
            "商品目前的狀態不允許此操作"
        );
    }

    private String normalize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
