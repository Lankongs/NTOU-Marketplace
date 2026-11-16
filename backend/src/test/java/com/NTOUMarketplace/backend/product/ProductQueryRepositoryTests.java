
package com.NTOUMarketplace.backend.product;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;

import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.junit.jupiter.api.BeforeEach;

import com.NTOUMarketplace.backend.MongoIntegrationTest;

@SpringBootTest
class ProductQueryRepositoryTests extends MongoIntegrationTest {

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private ProductQueryRepository queryRepository;

    @BeforeEach
    void clearProducts() {
        mongoTemplate.getCollection("products").deleteMany(new Document());
    }

    @Test
    void searchesFiltersAndSortsByCurrentPrice() {

        // 在隔離的測試資料庫中建立四筆商品
        mongoTemplate.getCollection("products").insertMany(List.of(
            new Document("_id", "test-keyboard")
                .append("type", "auction")
                .append("name", "競標鍵盤")
                .append("tags", List.of("電子"))
                .append("startPrice", 300),

            new Document("_id", "test-earphones")
                .append("type", "direct")
                .append("name", "二手藍牙耳機")
                .append("tags", List.of("電子", "二手"))
                .append("price", 500),

            new Document("_id", "test-bicycle")
                .append("type", "auction")
                .append("name", "競標腳踏車")
                .append("tags", List.of("交通"))
                .append("startPrice", 800)
                .append("currentPrice", 900),

            new Document("_id", "test-sony")
                .append("type", "direct")
                .append("name", "SONY 耳機")
                .append("tags", List.of("電子"))
                .append("price", 1200)
        ));

        // 測試價格由低到高
        assertNames(
            List.of("競標鍵盤", "二手藍牙耳機",
                    "競標腳踏車", "SONY 耳機"),
            queryRepository.search(null, null, null, "price_asc", null)
        );

        // 測試價格由高到低
        assertNames(
            List.of("SONY 耳機", "競標腳踏車",
                    "二手藍牙耳機", "競標鍵盤"),
            queryRepository.search(null, null, null, "price_desc", null)
        );

        // 測試關鍵字、類型及標籤組合
        assertNames(
            List.of("二手藍牙耳機", "SONY 耳機"),
            queryRepository.search(
                "耳機", "direct", "電子", "price_asc", null)
        );

        // 測試英文不區分大小寫
        assertNames(
            List.of("SONY 耳機"),
            queryRepository.search("sony", null, null, null, null)
        );

        // 測試查不到商品時回傳空結果
        assertNames(
            List.of(),
            queryRepository.search("notfound12345", null, null, null, null)
        );

        // 模擬競標最高價上升：900 -> 1500
        mongoTemplate.getCollection("products").updateOne(
            new Document("_id", "test-bicycle"),
            new Document("$set",
                new Document("currentPrice", 1500))
        );

        // 不用重新啟動程式，下一次查詢就應改變排序
        assertNames(
            List.of("競標鍵盤", "二手藍牙耳機",
                    "SONY 耳機", "競標腳踏車"),
            queryRepository.search(null, null, null, "price_asc", null)
        );
    }

    @Test
        void filtersProductsBySellingStatus() {

            // 建立四筆專門測試販售狀態的商品
            mongoTemplate.getCollection("products").insertMany(List.of(
                new Document("_id", "status-selling")
                    .append("type", "direct")
                    .append("name", "販售中的耳機")
                    .append("status", "selling")
                    .append("tags", List.of("電子"))
                    .append("price", 500),

                new Document("_id", "status-sold")
                    .append("type", "direct")
                    .append("name", "已售出的耳機")
                    .append("status", "sold")
                    .append("tags", List.of("電子"))
                    .append("price", 300),

                new Document("_id", "status-legacy")
                    .append("type", "direct")
                    .append("name", "舊版商品")
                    .append("tags", List.of("二手"))
                    .append("price", 800),

                new Document("_id", "status-auction")
                    .append("type", "auction")
                    .append("name", "販售中的競標鍵盤")
                    .append("status", "selling")
                    .append("tags", List.of("電子"))
                    .append("startPrice", 200)
            ));

            // 販售中：包含明確標記 selling，以及沒有 status 的舊商品
            assertNames(
                List.of("販售中的競標鍵盤", "販售中的耳機",  "舊版商品"),
                queryRepository.search(null, null, null, "price_asc", "selling")
            );

            // 已售出：只能找到明確標記 sold 的商品
            assertNames(
                List.of("已售出的耳機"),
                queryRepository.search(null, null, null, null, "sold")
            );

            // 多條件組合：直購、電子、販售中、價格由低到高
            assertNames(
                List.of("販售中的耳機"),
                queryRepository.search(null, "direct", "電子", "price_asc", "selling")
            );

            // 已售出商品也可以依價格排序
            assertNames(
                List.of("已售出的耳機"),
                queryRepository.search(null, null, null, "price_desc", "sold")
            );
        }

    private void assertNames(
            List<String> expected,
            List<Product> actual) {

        assertEquals(
            expected,
            actual.stream().map(Product::getName).toList()
        );
    }
}
