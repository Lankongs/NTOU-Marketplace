
package com.NTOUMarketplace.backend.product;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final ProductQueryRepository queryRepository;

    public ProductService(
            ProductRepository productRepository,
            ProductQueryRepository queryRepository) {
        this.productRepository = productRepository;
        this.queryRepository = queryRepository;
    }

    public List<Product> getAllProducts() {
        return productRepository.findAll();
    }

    public List<Product> searchProducts(String keyword) {
        return searchProducts(keyword, null, null);
    }

    public List<Product> searchProducts(
            String keyword, String type, String tag) {

        keyword = normalize(keyword);
        type = normalize(type);
        tag = normalize(tag);

        if (type != null
                && !type.equals("direct")
                && !type.equals("auction")) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "type 必須是 direct 或 auction"
            );
        }

        if (keyword == null && type == null && tag == null) {
            return getAllProducts();
        }

        return queryRepository.search(keyword, type, tag);
    }

    private String normalize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
