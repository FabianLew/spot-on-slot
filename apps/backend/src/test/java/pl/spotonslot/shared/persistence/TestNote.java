package pl.spotonslot.shared.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "test_note")
public class TestNote extends BaseEntity {

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    protected TestNote() {}

    public TestNote(String title) {
        this.title = title;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }
}
