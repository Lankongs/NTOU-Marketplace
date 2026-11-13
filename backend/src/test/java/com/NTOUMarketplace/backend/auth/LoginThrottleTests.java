package com.NTOUMarketplace.backend.auth;

import static org.junit.jupiter.api.Assertions.*;
import java.time.*;
import org.junit.jupiter.api.Test;

class LoginThrottleTests {
    static class MutableClock extends Clock {
        long time;
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return Instant.ofEpochMilli(time); }
        public long millis() { return time; }
    }
    @Test void expiresAndSuccessfulLoginResetsCount() {
        var clock = new MutableClock();
        var throttle = new LoginThrottle(clock);
        for (int i = 0; i < 10; i++) assertTrue(throttle.allow("test"));
        assertFalse(throttle.allow("test"));
        assertTrue(throttle.allow("another-ip"));
        clock.time = 900001;
        assertTrue(throttle.allow("test"));
        throttle.success("test");
        for (int i = 0; i < 9; i++) assertTrue(throttle.allow("test"));
        assertTrue(throttle.allow("test"));
        assertFalse(throttle.allow("test"));
    }
}
