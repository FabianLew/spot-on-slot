package pl.spotonslot.shared.persistence;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TestNoteRepository extends JpaRepository<TestNote, UUID> {
}
