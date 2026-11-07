> Evidence (2026-11-07): Adapted from the existing user manual with identified differences corrected; not every UI step or runtime path has been verified. See [provenance and limits](../verification.md).

> This manual ships with LemonMCP. Start with the [AI guide](../AI_GUIDE.md); use the [rule reference](../reference/rewrite-rules.md), [script API](../reference/script-api.md), and [compatibility notes](../reference/compatibility.md) for exact contracts.

# Database

Database shows Lemon's local SQLite storage overview, tables, schema, and records, and provides SQL Console for controlled queries. It is intended for diagnosing persistence and related debugging data, not for routine business data administration.

## What the page shows

The database overview can include:

- Total storage size.
- Tables and their record counts.
- Applied migrations.
- Entry points to table details and SQL Console.

Table details show columns, types, nullability, and records. Inspect the current schema before writing a query; do not rely on a guessed or historical column name.

## Query safely

Start with a read-only query:

```sql
SELECT *
FROM your_table
LIMIT 20;
```

Then add conditions and ordering gradually. `your_table` is a placeholder, not a fixed Lemon table name; use the table and column names shown by the current App version.

For large tables, select only the fields you need and use `WHERE` and `LIMIT`. When diagnosing live data, account for timestamps, pagination, and writes that may still be happening in the runtime.

## Write risks

The statements and permissions accepted by SQL Console depend on the current App version. Any `UPDATE`, `DELETE`, `INSERT`, DDL, or migration operation can damage request records, configuration, or runtime state:

1. Query the target rows first.
2. Record the original values or make a recoverable copy.
3. Use precise primary-key conditions; never use an unbounded update or delete.
4. Query again after the operation and verify the affected scope.
5. Reload or restart the relevant runtime when needed, then verify that the App accepts the new state.

Do not delete migration records to “repair” the schema and do not overwrite databases across versions. Migration state is part of Lemon's consistency boundary.

## Relationship to other features

Requests, DNS, Replay, and scheduled execution data can live in different tables. Database is best for questions such as “was this persisted?”, “are the counts reasonable?”, and “did migrations apply?”. Use the feature's own detail view to understand the network meaning of a request.

Database content can include full URLs, bodies, cookies, tokens, and local paths. Redact SQL results before sharing them with another person or an AI, and remove temporary exports after diagnosis.
