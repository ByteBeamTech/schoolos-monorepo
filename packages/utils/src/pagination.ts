export interface PaginationQuery {
  page?: number
  limit?: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export function paginate(query: PaginationQuery): { skip: number; take: number; page: number; limit: number } {
  const page  = Math.max(1, query.page  ?? 1)
  const limit = Math.min(100, Math.max(1, query.limit ?? 20))
  return { skip: (page - 1) * limit, take: limit, page, limit }
}

export function toPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}
