
package com.NTOUMarketplace.backend.product;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.security.core.Authentication;
import com.NTOUMarketplace.backend.auth.MemberRepository;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductService productService;
    private final MemberRepository members;

    public ProductController(
        ProductService productService,
        MemberRepository members) {
    this.productService = productService;
    this.members = members;
    }

    @GetMapping
    public List<Product> getProducts(
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) String type,
        @RequestParam(required = false) String tag,
        @RequestParam(required = false) String sort,
        @RequestParam(required = false) String status
        ) {
            return productService.searchProducts(
                keyword, type, tag, sort, status
            );
        }

    @GetMapping("/mine")
    public List<Product> getMyProducts(Authentication auth) {

        // 取得目前登入的會員 ID
        var member = members.find(auth.getName()).orElseThrow();

        // 只查詢屬於目前登入會員的商品
        return productService.getProductsBySellerId(member.id());
    }

    //PATCH /api/products/{id}/delist：下架商品。
    @PatchMapping("/{id}/delist")
    public ResponseEntity<Product> delistProduct(
            @PathVariable String id,
            Authentication auth) {

        var member = members.find(auth.getName()).orElseThrow();

        Product product = productService.changeStatus(
            id, member.id(), "selling", "delisted"
        );

        return ResponseEntity.ok(product);
    }

    //PATCH /api/products/{id}/relist：重新上架商品。
    @PatchMapping("/{id}/relist")
    public ResponseEntity<Product> relistProduct(
            @PathVariable String id,
            Authentication auth) {

        var member = members.find(auth.getName()).orElseThrow();

        Product product = productService.changeStatus(
            id, member.id(), "delisted", "selling"
        );

        return ResponseEntity.ok(product);
    }


}
