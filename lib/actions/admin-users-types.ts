/** Result types for admin user actions — lives outside `admin-users.ts` because `"use server"` files may only export async functions. */

export type BanResult = { ok: true } | { ok: false; error: string };
export type UnbanResult = { ok: true } | { ok: false; error: string };
export type DeleteUserResult = { ok: true } | { ok: false; error: string };
export type EditRoleResult = { ok: true } | { ok: false; error: string };
