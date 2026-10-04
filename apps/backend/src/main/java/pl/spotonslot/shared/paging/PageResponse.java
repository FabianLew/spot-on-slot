package pl.spotonslot.shared.paging;

import java.util.List;
import org.springframework.data.domain.Page;

/** Stable JSON envelope for paged list endpoints (0-based page index). */
public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {

    public static <T> PageResponse<T> from(Page<T> page) {
        return from(page, page.getContent());
    }

    /** Uses the paging metadata of {@code page} with already mapped {@code content}. */
    public static <T> PageResponse<T> from(Page<?> page, List<T> content) {
        return new PageResponse<>(content, page.getNumber(), page.getSize(), page.getTotalElements(),
                page.getTotalPages());
    }
}
