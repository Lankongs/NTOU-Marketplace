package com.NTOUMarketplace.backend.auth;

import java.time.Clock;
import java.util.HashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class LoginThrottle {
    private record Attempt(int count, long expires) {}
    private final Map<String, Attempt> attempts = new HashMap<>();
    private final Clock clock;
    public LoginThrottle() { this(Clock.systemUTC()); }
    LoginThrottle(Clock clock) { this.clock = clock; }
    public synchronized boolean allow(String ip) {
        long now = clock.millis();
        attempts.entrySet().removeIf(entry -> entry.getValue().expires() <= now);
        var current = attempts.get(ip);
        if (current != null && current.count() >= 10) return false;
        if (current == null && attempts.size() >= 10000) return false;
        attempts.put(ip, new Attempt(current == null ? 1 : current.count() + 1,
            current == null ? now + 15 * 60 * 1000 : current.expires()));
        return true;
    }
    public synchronized void success(String ip) { attempts.remove(ip); }
}
