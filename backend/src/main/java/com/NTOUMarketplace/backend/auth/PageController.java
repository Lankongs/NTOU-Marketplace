package com.NTOUMarketplace.backend.auth;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class PageController {
    @GetMapping("/login") String login() { return "redirect:/login.html"; }
    @GetMapping("/home") String home() { return "redirect:/index.html"; }
}
