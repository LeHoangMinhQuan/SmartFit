import { Knex } from "knex";

export async function seed(knex: Knex): Promise<void> {
  const existing = await knex("delivery_provider")
    .whereRaw("LOWER(code::text) = '2'")
    .first();

  let provider_id: number;

  if (!existing) {
    const [row] = await knex("delivery_provider")
      .insert({
        name: "Giao Hàng Nhanh",
        code: 2,
        api_url: "https://dev-online-gateway.ghn.vn/shiip/public-api/v2",
        is_active: true,
      })
      .returning("provider_id");
    provider_id = row.provider_id;
    console.log(`Seeded delivery provider: GHN (id=${provider_id})`);
  } else {
    provider_id = existing.provider_id;
    console.log("GHN delivery provider already exists — skipping.");
  }

  // Seed common GHN service tiers
  const services = [
    { name: "Express", type: 1 },
    { name: "Standard", type: 2 },
    { name: "Economy", type: 3 },
  ];

  for (const svc of services) {
    const exists = await knex("delivery_service")
      .where({ provider_id, type: svc.type })
      .first();

    if (!exists) {
      const [row] = await knex("delivery_service")
        .insert({
          provider_id,
          name: svc.name,
          type: svc.type,
          is_active: true,
        })
        .returning("service_id");
      console.log(
        `Seeded delivery service: ${svc.name} (id=${row.service_id})`,
      );
    }
  }
}
