//repository_new
package com.NTOUMarketplace.backend.product;

import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ProductRepository
        extends MongoRepository<Product, String> {

    List<Product> findByNameContainingIgnoreCase(String keyword);
}
