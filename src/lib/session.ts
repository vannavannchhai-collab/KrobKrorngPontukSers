/**
 * There is no login anymore: the app runs entirely in the browser.
 * Pages that used to adapt to the signed-in role now simply get a local
 * "full access" user, so every screen stays editable.
 */
export interface LocalUser {
  id: number;
  name: string;
  name_en: string | null;
  role: "admin" | "teacher";
  email: string | null;
  subject_id: number | null;
}

const LOCAL_USER: LocalUser = {
  id: 0,
  name: "អ្នកប្រើប្រាស់ក្នុងឧបករណ៍",
  name_en: "Local user",
  role: "admin",
  email: null,
  subject_id: null,
};

export function useSession() {
  return { user: LOCAL_USER, loading: false };
}
