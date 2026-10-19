package com.NTOUMarketplace.backend.auth;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@Profile("demo")
public class DemoMemberInitializer implements CommandLineRunner {
    private final MemberRepository members;
    private final PasswordEncoder encoder;
    public DemoMemberInitializer(MemberRepository members, PasswordEncoder encoder) { this.members = members; this.encoder = encoder; }
    @Override public void run(String... args) {
        if (members.find("demo").isEmpty()) members.create("demo", "海大同學", encoder.encode("Campus123!"));
    }
}
