package pl.spotonslot.shared.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;
import pl.spotonslot.support.IntegrationTest;

@IntegrationTest
class BaseEntityIntegrationTest {

    private static final Instant T10 = Instant.parse("2026-01-01T10:00:00Z");
    private static final Instant T11 = Instant.parse("2026-01-01T11:00:00Z");

    @MockitoBean
    Clock clock;

    @Autowired
    TestNoteRepository repository;

    @Autowired
    TransactionTemplate tx;

    @BeforeEach
    void setUp() {
        when(clock.getZone()).thenReturn(ZoneOffset.UTC);
        at(T10);
    }

    private void at(Instant instant) {
        when(clock.instant()).thenReturn(instant);
    }

    @Test
    void assignsUuidV7OnCreation() {
        assertThat(new TestNote("a").getId().version()).isEqualTo(7);
    }

    @Test
    void fillsAuditFieldsOnInsert() {
        TestNote saved = tx.execute(s -> repository.saveAndFlush(new TestNote("a")));

        TestNote loaded = repository.findById(saved.getId()).orElseThrow();
        assertThat(loaded.getCreatedAt()).isEqualTo(T10);
        assertThat(loaded.getUpdatedAt()).isEqualTo(T10);
        assertThat(loaded.getVersion()).isZero();
    }

    @Test
    void updatesAuditFieldsOnChange() {
        UUID id = tx.execute(s -> repository.saveAndFlush(new TestNote("a")).getId());

        at(T11);
        tx.executeWithoutResult(s -> {
            repository.findById(id).orElseThrow().setTitle("b");
            repository.flush();
        });

        TestNote loaded = repository.findById(id).orElseThrow();
        assertThat(loaded.getTitle()).isEqualTo("b");
        assertThat(loaded.getCreatedAt()).isEqualTo(T10);
        assertThat(loaded.getUpdatedAt()).isEqualTo(T11);
        assertThat(loaded.getVersion()).isEqualTo(1L);
    }

    @Test
    void rejectsStaleUpdate() {
        UUID id = tx.execute(s -> repository.saveAndFlush(new TestNote("a")).getId());
        TestNote stale = tx.execute(s -> repository.findById(id).orElseThrow());
        tx.executeWithoutResult(s -> repository.findById(id).orElseThrow().setTitle("first"));

        stale.setTitle("second");
        assertThatThrownBy(() -> tx.executeWithoutResult(s -> repository.saveAndFlush(stale)))
                .isInstanceOf(ObjectOptimisticLockingFailureException.class);
    }

    @Test
    void equalityById() {
        UUID id = tx.execute(s -> repository.saveAndFlush(new TestNote("a")).getId());

        TestNote first = tx.execute(s -> repository.findById(id).orElseThrow());
        TestNote second = tx.execute(s -> repository.findById(id).orElseThrow());

        assertThat(first).isNotSameAs(second).isEqualTo(second);
        assertThat(first.hashCode()).isEqualTo(second.hashCode());
    }
}
