package com.NTOUMarketplace.backend.auth;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = AuthController.class)
public class AuthErrors {
    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class})
    ResponseEntity<?> invalidInput(HttpServletRequest request) {
        if ("/api/auth/register".equals(request.getServletPath())) {
            return ResponseEntity.badRequest().body(Map.of("message",
                "請填寫有效的帳號、1 至 100 字的顯示名稱，以及至少 8 字的密碼。"));
        }
        return ResponseEntity.badRequest().body(Map.of("message", "請填寫有效的帳號與密碼。"));
    }
}
