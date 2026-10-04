package pl.spotonslot.shared.paging;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.Set;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import pl.spotonslot.shared.error.InvalidRequestException;

/**
 * Paging parameters of list endpoints: 0-based {@code page}, {@code size} (default 20, max 100)
 * and {@code sort} as {@code field[,asc|desc]}.
 */
public record PageQuery(@Min(0) Integer page, @Min(1) @Max(100) Integer size, String sort) {

    static final int DEFAULT_SIZE = 20;
    private static final String INVALID_SORT = "INVALID_SORT";

    public Pageable toPageable(Set<String> allowedSortFields, Sort defaultSort) {
        return PageRequest.of(
                page == null ? 0 : page,
                size == null ? DEFAULT_SIZE : size,
                parseSort(allowedSortFields, defaultSort));
    }

    private Sort parseSort(Set<String> allowedSortFields, Sort defaultSort) {
        if (sort == null || sort.isBlank()) {
            return defaultSort;
        }
        String[] parts = sort.split(",", -1);
        if (parts.length > 2) {
            throw new InvalidRequestException(INVALID_SORT);
        }
        String field = parts[0].trim();
        if (field.isEmpty() || !allowedSortFields.contains(field)) {
            throw new InvalidRequestException(INVALID_SORT);
        }
        Sort.Direction direction = parts.length == 1 ? Sort.Direction.ASC : parseDirection(parts[1].trim());
        return Sort.by(direction, field);
    }

    private static Sort.Direction parseDirection(String value) {
        if ("asc".equalsIgnoreCase(value)) {
            return Sort.Direction.ASC;
        }
        if ("desc".equalsIgnoreCase(value)) {
            return Sort.Direction.DESC;
        }
        throw new InvalidRequestException(INVALID_SORT);
    }
}
