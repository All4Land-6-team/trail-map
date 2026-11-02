package com.all4land.trailmap.domain.user.repository;

import com.all4land.trailmap.domain.user.entity.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {
    boolean existsByEmailIgnoreCase(String email);

    java.util.Optional<AppUser> findByEmailIgnoreCase(String email);
}
