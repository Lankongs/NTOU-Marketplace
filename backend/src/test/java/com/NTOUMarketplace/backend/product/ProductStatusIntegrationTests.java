
package com.NTOUMarketplace.backend.product;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;

import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import org.springframework.data.mongodb.core.query.Query;

import com.NTOUMarketplace.backend.MongoIntegrationTest;

@SpringBootTest
class ProductStatusIntegrationTests extends MongoIntegrationTest {

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private ProductService productService;

    @BeforeEach
    void setUp() {
        mongoTemplate.getCollection("products")
            .deleteMany(new Document());

        // 會員 1 的販售中商品
        mongoTemplate.getCollection("products").insertOne(
            new Document("_id", "product-1")
                .append("sellerId", 1L)
                .append("name", "我的耳機")
                .append("type", "direct")
                .append("price", 500)
                .append("status", "selling")
        );

        // 會員 2 的商品
        mongoTemplate.getCollection("products").insertOne(
            new Document("_id", "product-2")
                .append("sellerId", 2L)
                .append("name", "別人的鍵盤")
                .append("type", "direct")
                .append("price", 800)
                .append("status", "selling")
        );

        // 會員 1 已售出的商品
        mongoTemplate.getCollection("products").insertOne(
            new Document("_id", "product-sold")
                .append("sellerId", 1L)
                .append("name", "已售出的滑鼠")
                .append("type", "direct")
                .append("price", 300)
                .append("status", "sold")
        );
    }

    @Test
    void ownerCanDelistAndRelistProduct() {

        // 下架
        Product delisted = productService.changeStatus(
            "product-1", 1L, "selling", "delisted"
        );

        assertEquals("delisted", delisted.getStatus());

        // 一般商品列表不能看到已下架商品
        List<Product> publicProducts =
            productService.searchProducts(
                null, null, null, null, null
            );

        assertFalse(publicProducts.stream()
            .anyMatch(p -> p.getId().equals("product-1")));

        // 賣家自己的商品管理列表仍然看得到
        List<Product> myProducts =
            productService.getProductsBySellerId(1L);

        assertTrue(myProducts.stream()
            .anyMatch(p -> p.getId().equals("product-1")
                && p.getStatus().equals("delisted")));

        // 重新上架
        Product relisted = productService.changeStatus(
            "product-1", 1L, "delisted", "selling"
        );

        assertEquals("selling", relisted.getStatus());

        // 重新上架後，一般列表應再次顯示
        publicProducts = productService.searchProducts(
            null, null, null, null, null
        );

        assertTrue(publicProducts.stream()
            .anyMatch(p -> p.getId().equals("product-1")));
    }

    @Test
    void otherSellerCannotChangeProductStatus() {

        // 會員 2 嘗試下架會員 1 的商品
        ResponseStatusException error = assertThrows(
            ResponseStatusException.class,
            () -> productService.changeStatus(
                "product-1", 2L, "selling", "delisted"
            )
        );

        assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());

        // 確認商品狀態沒有被更改
        Product product = productService.getProductsBySellerId(1L)
            .stream()
            .filter(p -> p.getId().equals("product-1"))
            .findFirst()
            .orElseThrow();

        assertEquals("selling", product.getStatus());
    }

    @Test
    void soldProductCannotBeDelisted() {

        ResponseStatusException error = assertThrows(
            ResponseStatusException.class,
            () -> productService.changeStatus(
                "product-sold", 1L, "selling", "delisted"
            )
        );

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    void nonexistentProductReturns404() {

        ResponseStatusException error = assertThrows(
            ResponseStatusException.class,
            () -> productService.changeStatus(
                "not-existing", 1L, "selling", "delisted"
            )
        );

        assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
    }

@Test
void delistedProductsCannotBeQueriedThroughPublicApi() {

    // 先將會員 1 的商品下架
    productService.changeStatus(
        "product-1", 1L, "selling", "delisted"
    );

    // 一般商品查詢不允許指定 status=delisted
    ResponseStatusException error = assertThrows(
        ResponseStatusException.class,
        () -> productService.searchProducts(
            null, null, null, null, "delisted"
        )
    );

    assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
}

@Test
void searchAndSortMustHideDelistedProducts() {

    // 新增標籤，讓商品可以被標籤條件搜尋
    mongoTemplate.getCollection("products").updateOne(
        new Document("_id", "product-1"),
        new Document("$set", new Document("tags", List.of("電子")))
    );

    // 將商品下架
    productService.changeStatus(
        "product-1", 1L, "selling", "delisted"
    );

    // 即使使用關鍵字、類型、標籤及價格排序，
    // 也不能查到已下架商品
    List<Product> results = productService.searchProducts(
        "耳機", "direct", "電子", "price_asc", null
    );

    assertFalse(results.stream()
        .anyMatch(p -> p.getId().equals("product-1")));
}

@Test
void productWithoutSellerIdCannotBeDelisted() {

    // 模擬沒有 sellerId 的舊測試商品
    mongoTemplate.getCollection("products").insertOne(
        new Document("_id", "product-no-owner")
            .append("name", "沒有賣家的商品")
            .append("type", "direct")
            .append("price", 100)
            .append("status", "selling")
    );

    // 即使會員 1 嘗試下架，也應拒絕
    ResponseStatusException error = assertThrows(
        ResponseStatusException.class,
        () -> productService.changeStatus(
            "product-no-owner", 1L, "selling", "delisted"
        )
    );

    assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());

    // 確認資料庫中的商品仍然是 selling
    Document product = mongoTemplate.getCollection("products")
        .find(new Document("_id", "product-no-owner"))
        .first();

    assertNotNull(product);
    assertEquals("selling", product.getString("status"));
    }

}
