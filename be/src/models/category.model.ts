import db from "../config/db.js";

export interface Category {
  category_id?: number;
  name: string;
  parent_id?: number | null;
}

export async function findAllCategories() {
  return db("category").select("*").orderBy("category_id");
}

export async function findCategoryById(category_id: number) {
  return db("category").where({ category_id }).first();
}

export async function createCategory(
  data: Omit<Category, "category_id">,
): Promise<number> {
  const [row] = await db("category").insert(data).returning("category_id");
  return row.category_id;
}

export async function updateCategory(
  category_id: number,
  data: Partial<Omit<Category, "category_id">>,
) {
  return db("category").where({ category_id }).update(data);
}

export async function deleteCategory(category_id: number) {
  return db("category").where({ category_id }).delete();
}

/**
 * Build a nested tree from flat rows.
 * parent_id → category_id (ON DELETE SET NULL)
 */
export function buildCategoryTree(rows: Category[]): any[] {
  const map = new Map<number, any>();
  const roots: any[] = [];

  for (const row of rows) {
    map.set(row.category_id!, { ...row, children: [] });
  }

  for (const row of rows) {
    if (row.parent_id != null && map.has(row.parent_id)) {
      map.get(row.parent_id).children.push(map.get(row.category_id!));
    } else {
      roots.push(map.get(row.category_id!));
    }
  }

  return roots;
}
