import { PaginationDto } from '../../common/dto/pagination.dto';

// Pagination-only for now; kept in its own DTO so future filters (search,
// date range) can be added without touching the controller signature.
export class ProfileLeadsQueryDto extends PaginationDto {}
