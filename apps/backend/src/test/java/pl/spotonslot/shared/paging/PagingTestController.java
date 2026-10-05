package pl.spotonslot.shared.paging;

import io.swagger.v3.oas.annotations.Hidden;
import jakarta.validation.Valid;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pl.spotonslot.shared.persistence.TestNote;
import pl.spotonslot.shared.persistence.TestNoteRepository;

@RequiredArgsConstructor
@Hidden
@RestController
@RequestMapping("/test/paging")
class PagingTestController {

    private static final Set<String> SORTABLE = Set.of("title", "createdAt");
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.DESC, "createdAt");

    private final TestNoteRepository repository;

    @GetMapping
    PageResponse<NoteDto> list(@Valid @ParameterObject PageQuery query) {
        Page<TestNote> page = repository.findAll(query.toPageable(SORTABLE, DEFAULT_SORT));
        return PageResponse.from(page, page.getContent().stream()
                .map(note -> new NoteDto(note.getId(), note.getTitle())).toList());
    }

    record NoteDto(UUID id, String title) {
    }
}
