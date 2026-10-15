package pl.spotonslot.identity;

import jakarta.persistence.criteria.Predicate;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.spotonslot.identity.application.SessionService;
import pl.spotonslot.identity.domain.AccountStatus;
import pl.spotonslot.identity.domain.IdentityErrors;
import pl.spotonslot.identity.domain.OneTimeToken;
import pl.spotonslot.identity.domain.TokenType;
import pl.spotonslot.identity.domain.UserAccount;
import pl.spotonslot.identity.infrastructure.OneTimeTokenRepository;
import pl.spotonslot.identity.infrastructure.RefreshTokenRepository;
import pl.spotonslot.identity.infrastructure.UserAccountRepository;
import pl.spotonslot.shared.security.SecretToken;

/**
 * Accounts for the admin panel (moderation module): finding accounts, blocking and unblocking them, and the admins
 * themselves. Blocking ends every session at once; the per-request status check rejects access tokens already
 * issued.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AccountAdministration {

    private final UserAccountRepository accounts;
    private final RefreshTokenRepository refreshTokens;
    private final OneTimeTokenRepository tokens;
    private final SessionService sessions;
    private final PasswordEncoder passwordEncoder;
    private final ApplicationEventPublisher events;
    private final IdentityProperties properties;
    private final TermsProperties terms;
    private final Clock clock;

    /**
     * Accounts whose e-mail contains {@code query} (any case) or whose id is in {@code matchingIds} (found by name in
     * other modules), narrowed by role and state, newest first. Without a query every account matches.
     */
    @Transactional(readOnly = true)
    public Page<AdminAccount> search(String query, Collection<UUID> matchingIds, Role role, AccountState state,
            Pageable pageable) {
        Specification<UserAccount> spec = (root, criteria, builder) -> {
            var predicates = new ArrayList<Predicate>();
            if (query != null && !query.isBlank()) {
                var pattern = "%" + query.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%")
                        .replace("_", "\\_") + "%";
                var byEmail = builder.like(root.get("email"), pattern, '\\');
                predicates.add(matchingIds.isEmpty() ? byEmail : builder.or(byEmail, root.get("id").in(matchingIds)));
            }
            if (role != null) {
                predicates.add(builder.equal(root.get("role"), role));
            }
            if (state != null) {
                predicates.add(builder.equal(root.get("status"), AccountStatus.valueOf(state.name())));
            }
            return builder.and(predicates.toArray(Predicate[]::new));
        };
        var page = accounts.findAll(spec, PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
                Sort.by(Sort.Direction.DESC, "createdAt", "id")));
        var lastSignIn = lastSignIn(page.getContent().stream().map(UserAccount::getId).toList());
        return page.map(account -> view(account, lastSignIn.get(account.getId())));
    }

    @Transactional(readOnly = true)
    public Optional<AdminAccount> find(UUID id) {
        return accounts.findById(id).map(account -> view(account, lastSignIn(List.of(id)).get(id)));
    }

    /**
     * Blocks the account: it is signed out everywhere and modules hide what others see of it
     * ({@link AccountBlocked}).
     *
     * @throws IdentityErrors.CannotBlockSelf for the acting admin's own account
     * @throws IdentityErrors.LastAdmin for the last active admin
     * @throws IdentityErrors.BlockDeletionPending for an account waiting for deletion
     */
    @Transactional
    public AdminAccount block(UUID adminId, UUID userId, String reason) {
        if (adminId.equals(userId)) {
            throw new IdentityErrors.CannotBlockSelf();
        }
        var account = account(userId);
        if (account.isBlocked()) {
            return view(account, null);
        }
        if (account.isDeletionPending()) {
            throw new IdentityErrors.BlockDeletionPending();
        }
        if (account.getRole() == Role.ADMIN && account.getStatus() == AccountStatus.ACTIVE
                && accounts.countByRoleAndStatus(Role.ADMIN, AccountStatus.ACTIVE) <= 1) {
            throw new IdentityErrors.LastAdmin();
        }
        // Microseconds, as the database stores them, so the answer matches what a later read returns.
        account.block(reason, clock.instant().truncatedTo(ChronoUnit.MICROS));
        sessions.revokeAll(userId);
        events.publishEvent(new AccountBlocked(userId, account.getEmail(), account.getLocale(), reason));
        log.info("Account {} blocked by admin {}", userId, adminId);
        return view(account, null);
    }

    /** Lifts a block; an account that is not blocked stays as it is. */
    @Transactional
    public AdminAccount unblock(UUID adminId, UUID userId) {
        var account = account(userId);
        if (account.unblock()) {
            events.publishEvent(new AccountUnblocked(userId));
            log.info("Account {} unblocked by admin {}", userId, adminId);
        }
        return view(account, null);
    }

    /** Every admin account, oldest first. */
    @Transactional(readOnly = true)
    public List<AdminAccount> admins() {
        var admins = accounts.findByRoleOrderByCreatedAt(Role.ADMIN);
        var lastSignIn = lastSignIn(admins.stream().map(UserAccount::getId).toList());
        return admins.stream().map(account -> view(account, lastSignIn.get(account.getId()))).toList();
    }

    /**
     * Creates an admin account for {@code email} and sends it a link that sets its password.
     *
     * @throws IdentityErrors.AdminEmailTaken when the address already has an account
     */
    @Transactional
    public AdminAccount inviteAdmin(String email) {
        var normalized = email.trim().toLowerCase(Locale.ROOT);
        if (accounts.findByEmail(normalized).isPresent()) {
            throw new IdentityErrors.AdminEmailTaken();
        }
        var now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        var account = accounts.save(UserAccount.invitedAdmin(normalized,
                passwordEncoder.encode(SecretToken.generate()), "pl", terms.version(), now));
        var raw = SecretToken.generate();
        tokens.save(OneTimeToken.issue(account.getId(), TokenType.PASSWORD_RESET, SecretToken.hash(raw),
                now.plus(properties.adminInvitationTtl())));
        events.publishEvent(new AdminInvited(account.getEmail(), account.getLocale(), raw));
        return view(account, null);
    }

    private UserAccount account(UUID id) {
        return accounts.findById(id).orElseThrow(IdentityErrors.AdminAccountNotFound::new);
    }

    private Map<UUID, Instant> lastSignIn(Collection<UUID> ids) {
        var result = new HashMap<UUID, Instant>();
        if (!ids.isEmpty()) {
            for (var row : refreshTokens.findLastIssuedAmong(ids)) {
                result.put((UUID) row[0], (Instant) row[1]);
            }
        }
        return result;
    }

    private static AdminAccount view(UserAccount account, Instant lastSignInAt) {
        return new AdminAccount(account.getId(), account.getEmail(), account.getRole(),
                AccountState.valueOf(account.getStatus().name()), account.getCreatedAt(), lastSignInAt,
                account.getBlockedAt(), account.getBlockReason(), account.getDeletionRequestedAt());
    }
}
