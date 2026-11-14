
package com.NTOUMarketplace.backend.product;

import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "products")
public class Product {

    @Id
    private String id;

    private String type;
    private String name;
    private String desc;
    private String shipping;
    private String image;
    private List<String> tags;

    // 直購商品欄位
    private Integer price;
    private Integer quantity;

    // 競標商品欄位
    private Integer startPrice;
    private Integer bidIncrement;
    private String endTime; //競標時間先用 String 接收，正式實作競標規則前會改成更適合時間運算的型別；
    private Integer restrictedMinutes;

    public Product() {
    }

    public String getId() { return id; }
    public String getType() { return type; }
    public String getName() { return name; }
    public String getDesc() { return desc; }
    public String getShipping() { return shipping; }
    public String getImage() { return image; }
    public List<String> getTags() { return tags; }
    public Integer getPrice() { return price; }
    public Integer getQuantity() { return quantity; }
    public Integer getStartPrice() { return startPrice; }
    public Integer getBidIncrement() { return bidIncrement; }
    public String getEndTime() { return endTime; }
    public Integer getRestrictedMinutes() { return restrictedMinutes; }
}
