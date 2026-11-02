package com.NTOUMarketplace.backend.auth;

import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class MemberRepository {
    private final JdbcTemplate jdbc;
    public MemberRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public record Member(long id, String account, String displayName, String passwordHash) {}
    public Optional<Member> find(String account) {
        return jdbc.query("SELECT id, account, display_name, password_hash FROM members WHERE account = ?",
            (rs, n) -> new Member(rs.getLong("id"), rs.getString("account"), rs.getString("display_name"), rs.getString("password_hash")), account)
            .stream().findFirst();
    }
    public void create(String account, String name, String hash) {
        jdbc.update("INSERT INTO members(account, display_name, password_hash) VALUES (?, ?, ?)", account, name, hash);
    }
}
