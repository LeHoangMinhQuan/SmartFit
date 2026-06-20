// import { Request } from "express";

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface Request {
  query: PaginationParams;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * parsePagination
 *
 * Reads `page` and `limit` from req.query with safe defaults and a hard cap.
 * Pass the result directly into Knex: .limit(limit).offset(offset)
 *
 * Usage (controller):
 *   const { page, limit, offset } = parsePagination(req);
 *   const [rows, [{ count }]] = await Promise.all([
 *     db('product').limit(limit).offset(offset),
 *     db('product').count('product_id as count'),
 *   ]);
 *   res.json(paginate(rows, Number(count), page, limit));
 */
export const parsePagination = (req: Request): PaginationParams => {
  const page = Math.max(
    1,
    parseInt(String(req.query.page ?? DEFAULT_PAGE), 10) || DEFAULT_PAGE,
  );
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(
      1,
      parseInt(String(req.query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
    ),
  );

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
};

/**
 * paginate
 *
 * Wraps a result array with the meta envelope required by §8:
 *   { data: [...], meta: { page, limit, total, totalPages } }
 */
export const paginate = <T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> => ({
  data,
  meta: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  },
});
