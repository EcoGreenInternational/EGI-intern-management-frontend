// pages/social/socialApi.js – API client for the Social Media section.
import { API_BASE, getToken } from "../../utils/api";

async function call(method, path, body, { form = false } = {}) {
  const headers = { Authorization: `Bearer ${getToken()}` };
  if (body !== undefined && !form) headers["Content-Type"] = "application/json";
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method, headers,
      body: body === undefined ? undefined : form ? body : JSON.stringify(body),
    });
  } catch {
    throw new Error("Can't reach the server. Check your connection and try again.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || (res.status === 413 ? "That file is too large." : `Something went wrong (error ${res.status}).`));
  }
  return data || {};
}

const qs = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "" && v !== "All") p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const socialApi = {
  list:       (params)       => call("GET", `/social${qs(params)}`).then(d => d.data || []),
  get:        (id)           => call("GET", `/social/${id}`).then(d => d.data),
  create:     (body)         => call("POST", "/social", body).then(d => d.data),
  update:     (id, body)     => call("PUT", `/social/${id}`, body).then(d => d.data),
  submit:     (id)           => call("PATCH", `/social/${id}/submit`, {}).then(d => d.data),
  approve:    (id)           => call("PATCH", `/social/${id}/approve`, {}).then(d => d.data),
  reject:     (id, reason)   => call("PATCH", `/social/${id}/reject`, { reason }).then(d => d.data),
  markPosted: (id, postUrl)  => call("PATCH", `/social/${id}/mark-posted`, { postUrl }).then(d => d.data),
  results:    (id, metrics)  => call("PATCH", `/social/${id}/performance`, metrics).then(d => d.data),
  comment:    (id, text)     => call("POST", `/social/${id}/comments`, { text }).then(d => d.data),
  remove:     (id)           => call("DELETE", `/social/${id}`),
  dashboard:  (params)       => call("GET", `/social/dashboard${qs(params)}`).then(d => d.data),
  uploadMedia: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return call("POST", "/social/media", fd, { form: true }).then(d => d.media);
  },
  discardMedia: (m) => call("DELETE", "/social/media", { publicId: m.publicId, resourceType: m.resourceType }).catch(() => {}),

  projects:      ()         => call("GET", "/social-projects").then(d => d.data || []),
  members:       ()         => call("GET", "/social-projects/members").then(d => d.data || []),
  saveProject:   (id, body) => (id ? call("PUT", `/social-projects/${id}`, body) : call("POST", "/social-projects", body)).then(d => d.data),
  deleteProject: (id)       => call("DELETE", `/social-projects/${id}`),

  routines:      ()         => call("GET", "/social-routines").then(d => d.data || []),
  saveRoutine:   (id, body) => (id ? call("PUT", `/social-routines/${id}`, body) : call("POST", "/social-routines", body)),
  deleteRoutine: (id)       => call("DELETE", `/social-routines/${id}`),
};

export const notificationApi = {
  list:    () => call("GET", "/notifications?limit=30"),
  read:    (id) => call("PATCH", `/notifications/${id}/read`, {}),
  readAll: () => call("PATCH", "/notifications/read-all", {}),
};

// A post to open once the Social page is shown (set by the notification bell).
export const pendingOpen = { id: null };
export const OPEN_POST_EVENT = "egi:open-social-post";
export const NOTIFICATION_EVENT = "egi:notification";
