package pl.spotonslot.identity.application;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import pl.spotonslot.identity.AccountDeletionCheck;
import pl.spotonslot.identity.AccountDeletionRequested;
import pl.spotonslot.identity.AccountInfo;
import pl.spotonslot.identity.AccountRestored;
import pl.spotonslot.identity.DeletionBlocker;
import pl.spotonslot.identity.EmailChangeRequested;
import pl.spotonslot.identity.IdentityProperties;
import pl.spotonslot.identity.PasswordChanged;
import pl.spotonslot.identity.PersonalDataSection;
import pl.spotonslot.identity.TermsProperties;
import pl.spotonslot.identity.domain.AccountStatus;
import pl.spotonslot.identity.domain.IdentityErrors;
import pl.spotonslot.identity.domain.OneTimeToken;
import pl.spotonslot.identity.domain.TokenType;
import pl.spotonslot.identity.domain.UserAccount;
import pl.spotonslot.identity.infrastructure.OneTimeTokenRepository;
import pl.spotonslot.identity.infrastructure.UserAccountRepository;
import pl.spotonslot.shared.security.SecretToken;

/**
 * The signed-in owner's account settings: password, e-mail address, terms, data export and deletion. Changes that
 * matter for security ask for the current password ({@link PasswordAttempts} limits wrong ones).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AccountSettingsService {

    static final String ACCOUNT_SECTION = "account";

    private final UserAccountRepository accounts;
    private final OneTimeTokenRepository tokens;
    private final PasswordEncoder passwordEncoder;
    private final PasswordAttempts passwordAttempts;
    private final ExportLimit exportLimit;
    private final AccountService accountService;
    private final SessionService sessions;
    private final List<AccountDeletionCheck> deletionChecks;
    private final List<PersonalDataSection> personalData;
    private final ApplicationEventPublisher events;
    private final IdentityProperties properties;
    private final TermsProperties terms;
    private final TransactionTemplate transaction;
    private final Clock clock;

    /** When an account waiting for deletion is purged; null for any other account. */
    public Instant deletionScheduledAt(UserAccount account) {
        return account.getDeletionRequestedAt() == null ? null
                : account.getDeletionRequestedAt().plus(properties.deletionGrace());
    }

    public boolean termsAccepted(UserAccount account) {
        return account.hasAcceptedTerms(terms.version());
    }

    public String termsVersion() {
        return terms.version();
    }

    // ---- password

    /**
     * Sets a new password after checking the current one. Every other session ends; {@code sessionId} (the refresh
     * token family of the caller's access token, null when unknown) stays signed in.
     */
    @Transactional
    public void changePassword(UUID userId, UUID sessionId, String currentPassword, String newPassword) {
        var account = account(userId);
        passwordAttempts.verify(account, currentPassword, "currentPassword");
        if (account.getEmail().equals(Emails.normalize(newPassword))) {
            throw new IdentityErrors.PasswordEqualsEmail();
        }
        account.changePassword(passwordEncoder.encode(newPassword));
        sessions.revokeOthers(userId, sessionId);
        // Someone who knew the old password may have asked to move the account; that link stops working.
        tokens.useAllOf(userId, TokenType.EMAIL_CHANGE, clock.instant());
        events.publishEvent(new PasswordChanged(account.getEmail(), account.getLocale()));
    }

    // ---- e-mail address

    /**
     * Sends a confirmation link to {@code newEmail} and a notice to the current address. The answer is the same
     * whether or not another account uses {@code newEmail} (that account gets a notice instead of a link), and a
     * second request within the resend interval quietly does nothing.
     */
    @Transactional
    public void requestEmailChange(UUID userId, String newEmail, String currentPassword) {
        var account = account(userId);
        passwordAttempts.verify(account, currentPassword, "currentPassword");
        var target = Emails.normalize(newEmail);
        if (target.equals(account.getEmail())) {
            throw new IdentityErrors.EmailUnchanged();
        }
        var now = clock.instant();
        if (!accountService.canSend(account, TokenType.EMAIL_CHANGE, now)) {
            return;
        }
        var raw = SecretToken.generate();
        var token = OneTimeToken.emailChange(userId, SecretToken.hash(raw), target,
                now.plus(properties.emailChangeTokenTtl()));
        var taken = accounts.findByEmail(target).isPresent();
        if (taken) {
            // Kept for the resend interval only; the link is never sent, so nobody can use it.
            token.use(now);
        }
        tokens.save(token);
        events.publishEvent(new EmailChangeRequested(account.getEmail(), target, account.getLocale(),
                taken ? null : raw, taken));
    }

    /**
     * Moves the account to the address the link was sent to. Sessions stay; the next login uses the new address.
     *
     * @throws IdentityErrors.TokenInvalid for an unknown, used or expired link
     * @throws IdentityErrors.EmailTaken when another account took the address in the meantime
     */
    public void confirmEmailChange(String rawToken) {
        try {
            transaction.executeWithoutResult(status -> {
                var now = clock.instant();
                var token = tokens.findByTokenHashAndType(SecretToken.hash(rawToken), TokenType.EMAIL_CHANGE)
                        .filter(candidate -> candidate.isUsable(now))
                        .orElseThrow(IdentityErrors.TokenInvalid::new);
                var account = accounts.findById(token.getUserId())
                        .filter(found -> found.getStatus() == AccountStatus.ACTIVE)
                        .orElseThrow(IdentityErrors.TokenInvalid::new);
                if (accounts.findByEmail(token.getTargetEmail()).isPresent()) {
                    throw new IdentityErrors.EmailTaken();
                }
                token.use(now);
                account.changeEmail(token.getTargetEmail());
                accounts.flush();
            });
        } catch (DataIntegrityViolationException e) {
            // A registration or another change took the address between the check and the update.
            throw new IdentityErrors.EmailTaken();
        }
    }

    // ---- terms

    /** Accepts the current version of the terms of service and privacy policy. */
    @Transactional
    public void acceptTerms(UUID userId) {
        account(userId).acceptTerms(terms.version(), clock.instant());
    }

    // ---- export

    /**
     * Everything the service stores about the account, one section per module. At most one export per minute.
     */
    public Map<String, Object> export(UUID userId) {
        exportLimit.acquire(userId);
        var account = transaction.execute(status -> account(userId));
        var info = new AccountInfo(account.getId(), account.getEmail(), account.getRole(), account.getLocale());
        var export = new LinkedHashMap<String, Object>();
        export.put("exportedAt", clock.instant());
        // The account first, then the other sections by name.
        personalData.stream()
                .sorted(Comparator.comparing((PersonalDataSection section) -> !ACCOUNT_SECTION.equals(section.key()))
                        .thenComparing(PersonalDataSection::key))
                .forEach(section -> export.put(section.key(), section.export(info)));
        return export;
    }

    // ---- deletion

    /** What stops the account from being deleted now (e.g. venues that would lose their last owner). */
    @Transactional(readOnly = true)
    public List<DeletionBlocker> deletionBlockers(UUID userId) {
        return deletionChecks.stream().flatMap(check -> check.blockersFor(userId).stream()).toList();
    }

    /**
     * Schedules the account for deletion after the grace period: signs it out everywhere and lets the modules hide
     * it. Returns when it will be purged.
     *
     * @throws IdentityErrors.LastVenueOwner when a venue would be left without an owner
     */
    @Transactional
    public Instant requestDeletion(UUID userId, String password) {
        var account = account(userId);
        passwordAttempts.verify(account, password, "password");
        var blockers = deletionBlockers(userId);
        if (!blockers.isEmpty()) {
            throw new IdentityErrors.LastVenueOwner(blockers.stream().map(DeletionBlocker::name)
                    .collect(Collectors.joining(", ")));
        }
        // Microseconds, as the database stores them, so the answer matches what GET /me reads later.
        var now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        account.requestDeletion(now);
        sessions.revokeAll(userId);
        var deletionAt = deletionScheduledAt(account);
        events.publishEvent(new AccountDeletionRequested(userId, account.getEmail(), account.getLocale(),
                deletionAt));
        log.info("Account {} scheduled for deletion at {}", userId, deletionAt);
        return deletionAt;
    }

    /** Takes back a deletion request; an account that is not waiting for deletion stays as it is. */
    @Transactional
    public void cancelDeletion(UUID userId) {
        if (account(userId).restore()) {
            events.publishEvent(new AccountRestored(userId));
            log.info("Account {} restored", userId);
        }
    }

    private UserAccount account(UUID userId) {
        return accounts.findById(userId).orElseThrow(IdentityErrors.RefreshInvalid::new);
    }
}
