/**
 * Shared contribution formatting used by contributions.ts and admin.ts.
 */

/**
 * Format a contribution row for the API response.
 * When includeApiKey is true (admin context), the api_key is exposed.
 */
export function formatContribution(
  row: any,
  includeApiKey: boolean = false
): object {
  const result: any = {
    id: row.id,
    type: row.type,
    status: row.status,
    foodId: row.food_id,
    data: JSON.parse(row.data),
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    reviewerNote: row.reviewer_note,
  };

  if (includeApiKey) {
    result.apiKey = row.api_key;
  }

  return result;
}
