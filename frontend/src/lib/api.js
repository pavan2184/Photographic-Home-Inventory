import { API_URL } from "../config";
import { supabase } from "./supabase";

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token;
}

async function request(path, options = {}) {
  const token = await getToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (res.status === 204) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Upload
  getUploadURL: (filename, contentType = "image/jpeg") =>
    request("/upload", {
      method: "POST",
      body: JSON.stringify({ filename, content_type: contentType }),
    }),

  // Detection
  detect: (imageUrl) =>
    request("/items/detect", {
      method: "POST",
      body: JSON.stringify({ image_url: imageUrl }),
    }),

  // Items
  createItem: (item) =>
    request("/items", {
      method: "POST",
      body: JSON.stringify(item),
    }),

  listItems: () => request("/items"),

  getItem: (id) => request(`/items/${id}`),

  deleteItem: (id) => request(`/items/${id}`, { method: "DELETE" }),

  // Metadata
  listMetadata: (itemId) => request(`/items/${itemId}/metadata`),

  addMetadata: (itemId, key, value) =>
    request(`/items/${itemId}/metadata`, {
      method: "POST",
      body: JSON.stringify({ key, value }),
    }),

  deleteMetadata: (itemId, metadataId) =>
    request(`/items/${itemId}/metadata/${metadataId}`, { method: "DELETE" }),
};
