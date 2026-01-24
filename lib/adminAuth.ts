// Administrative Auth Gate removed. Helpers preserved for backward compatibility.
export async function signIn() {}
export async function signOut() {}
export async function getSession() {
  return { user: { id: "local-admin", email: "admin@londonkaraoke.club" } };
}
export async function checkAdminStatus() {
  return true;
}
export function onAuthChange(callback: () => void) {
  return () => {};
}
