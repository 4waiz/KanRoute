import { ContextDev } from "@context-dot-dev/convex";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { geocodeAddress } from "./geo";
import { supplierStatus } from "./schema";

const contextDev = new ContextDev(components.contextDev);

/**
 * What we need off a supplier's own website. Receiving hours are the load
 * bearing field: two deliveries can only share a vehicle if their receiving
 * windows overlap, so these cannot be guessed.
 */
const SUPPLIER_SCHEMA = {
  type: "object",
  properties: {
    companyName: { type: "string" },
    addressLine: {
      type: "string",
      description: "Full street address of the UAE office or warehouse.",
    },
    emirate: {
      type: "string",
      description: "Emirate, e.g. Dubai, Abu Dhabi, Sharjah.",
    },
    receivingFrom: {
      type: "string",
      description:
        "Earliest time goods can be received or the business opens, as 24h HH:MM.",
    },
    receivingTo: {
      type: "string",
      description:
        "Latest time goods can be received or the business closes, as 24h HH:MM.",
    },
    notes: {
      type: "string",
      description: "Any stated delivery, logistics or access constraint.",
    },
  },
  required: ["companyName", "addressLine"],
};

const INSTRUCTIONS = [
  "Extract the UAE business location and the hours during which this business",
  "can physically receive deliveries.",
  "",
  "Use the contact, locations, or about pages. If explicit goods-receiving",
  "hours are not published, fall back to the business opening hours and say so",
  "in notes. Always return times in 24-hour HH:MM format.",
  "",
  "If several UAE branches exist, prefer the Dubai head office or warehouse.",
].join("\n");

/** Demo roster: real UAE businesses, enriched from their own public sites. */
const DEMO_SUPPLIERS: { name: string; website: string }[] = [
  { name: "Aramex", website: "https://www.aramex.com" },
  { name: "Mai Dubai", website: "https://www.maidubai.com" },
  { name: "Jumbo Electronics", website: "https://www.jumbo.ae" },
  { name: "Al Maya Group", website: "https://www.almaya.ae" },
  { name: "Choithrams", website: "https://www.choithrams.com" },
  { name: "Spinneys", website: "https://www.spinneys.com" },
  { name: "Danube Home", website: "https://www.danubehome.com" },
  { name: "Al Ain Farms", website: "https://alainfarms.ae" },
  { name: "Union Coop", website: "https://www.unioncoop.ae" },
  { name: "Sharaf DG", website: "https://uae.sharafdg.com" },
  { name: "Emirates Post", website: "https://emiratespost.ae" },
];

export const seedDemoSuppliers = mutation({
  args: {},
  returns: v.array(v.id("suppliers")),
  handler: async (ctx) => {
    const existing = await ctx.db.query("suppliers").collect();
    const known = new Set(existing.map((e) => e.website));

    // Additive: adding suppliers to the roster should not wipe enriched rows.
    const ids = existing.map((e) => e._id);
    for (const s of DEMO_SUPPLIERS) {
      if (known.has(s.website)) continue;
      const id = await ctx.db.insert("suppliers", {
        name: s.name,
        website: s.website,
        status: "pending",
        createdAt: Date.now(),
      });
      ids.push(id);
      await ctx.scheduler.runAfter(0, internal.suppliers.enrich, {
        supplierId: id,
      });
    }
    return ids;
  },
});

export const addSupplier = mutation({
  args: { name: v.string(), website: v.string() },
  returns: v.id("suppliers"),
  handler: async (ctx, { name, website }) => {
    const id = await ctx.db.insert("suppliers", {
      name,
      website,
      status: "pending",
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.suppliers.enrich, { supplierId: id });
    return id;
  },
});

export const getInternal = internalQuery({
  args: { supplierId: v.id("suppliers") },
  returns: v.any(),
  handler: async (ctx, { supplierId }) => ctx.db.get("suppliers", supplierId),
});

export const patchSupplier = internalMutation({
  args: {
    supplierId: v.id("suppliers"),
    status: supplierStatus,
    address: v.optional(v.string()),
    emirate: v.optional(v.string()),
    receivingFrom: v.optional(v.string()),
    receivingTo: v.optional(v.string()),
    notes: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { supplierId, ...patch }) => {
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, val]) => val !== undefined),
    );
    await ctx.db.patch("suppliers", supplierId, clean);
    return null;
  },
});

/** Live Context.dev call. This is where real-world receiving hours come from. */
export const enrich = internalAction({
  args: { supplierId: v.id("suppliers") },
  returns: v.null(),
  handler: async (ctx, { supplierId }) => {
    const supplier = await ctx.runQuery(internal.suppliers.getInternal, {
      supplierId,
    });
    if (!supplier) return null;

    await ctx.runMutation(internal.suppliers.patchSupplier, {
      supplierId,
      status: "enriching",
    });
    await ctx.runMutation(internal.events.log, {
      supplierId,
      provider: "context.dev",
      type: "enrich.started",
      message: `Reading ${supplier.name} site for address and receiving hours`,
    });

    try {
      const result = (await contextDev.extract(ctx, {
        body: {
          url: supplier.website,
          schema: SUPPLIER_SCHEMA,
          instructions: INSTRUCTIONS,
          maxPages: 6,
          maxAgeMs: 604800000,
        },
      })) as {
        data?: Record<string, unknown>;
        urls_analyzed?: string[];
      };

      const clean = (val: unknown): string | undefined => {
        if (val === null || val === undefined) return undefined;
        const t = String(val).trim();
        if (!t || t.toLowerCase() === "null" || t.toLowerCase() === "n/a") {
          return undefined;
        }
        return t;
      };

      const d = result.data ?? {};
      const address = clean(d.addressLine);
      const geo = geocodeAddress(address);

      await ctx.runMutation(internal.suppliers.patchSupplier, {
        supplierId,
        // Only usable if we could place it on the map.
        status: geo ? "enriched" : "failed",
        address,
        emirate: clean(d.emirate),
        receivingFrom: clean(d.receivingFrom),
        receivingTo: clean(d.receivingTo),
        notes: clean(d.notes),
        sourceUrl: result.urls_analyzed?.[0] ?? supplier.website,
        lat: geo?.lat,
        lng: geo?.lng,
      });

      await ctx.runMutation(internal.events.log, {
        supplierId,
        provider: "context.dev",
        type: address ? "enrich.completed" : "enrich.empty",
        message: address
          ? `${supplier.name}: ${address.slice(0, 70)} | receiving ${d.receivingFrom ?? "?"}-${d.receivingTo ?? "?"}`
          : `${supplier.name}: no address found on site`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.suppliers.patchSupplier, {
        supplierId,
        status: "failed",
        notes: message.slice(0, 200),
      });
      await ctx.runMutation(internal.events.log, {
        supplierId,
        provider: "context.dev",
        type: "enrich.failed",
        message: `${supplier.name}: ${message.slice(0, 140)}`,
      });
    }
    return null;
  },
});

export const list = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) =>
    ctx.db.query("suppliers").withIndex("by_createdAt").order("asc").collect(),
});

export const listInternal = internalQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => ctx.db.query("suppliers").collect(),
});
