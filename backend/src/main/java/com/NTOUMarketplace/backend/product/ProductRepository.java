//repository_new
package com.NTOUMarketplace.backend.product;

import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ProductRepository
        extends MongoRepository<Product, String> {

    List<Product> findByNameContainingIgnoreCase(String keyword);

     // 查詢指定賣家的所有商品，包括已下架商品
    List<Product> findBySellerId(Long sellerId);
}
