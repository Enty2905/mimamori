package com.mimamori.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final com.mimamori.userprofile.repository.UserRepository users;

    public JwtAuthFilter(JwtService jwtService, com.mimamori.userprofile.repository.UserRepository users) {
        this.jwtService = jwtService;
        this.users = users;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (jwtService.validateToken(token)) {
                Long userId = jwtService.getUserIdFromToken(token);
                var user = users.findById(userId).orElse(null);
                Object version = jwtService.getClaims(token).get("version");
                if (user == null || !(version instanceof Number number) || number.longValue() != user.getSessionVersion()) {
                    filterChain.doFilter(request, response);
                    return;
                }
                String role = user.getRole().name();

                SimpleGrantedAuthority authority = new SimpleGrantedAuthority("ROLE_" + role);
                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                        userId, // Principal is userId (Long) for @AuthenticationPrincipal injection
                        token,
                        Collections.singletonList(authority)
                );

                SecurityContextHolder.getContext().setAuthentication(authentication);
                // Keep authentication on this request's SSE/error redispatch; never create an HTTP session.
                new org.springframework.security.web.context.RequestAttributeSecurityContextRepository()
                        .saveContext(SecurityContextHolder.getContext(), request, response);
            }
        }

        filterChain.doFilter(request, response);
    }
}
