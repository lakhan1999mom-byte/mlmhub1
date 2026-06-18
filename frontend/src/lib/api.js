import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_URL = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("evergro_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      // do not auto-clear to allow retry, but if /auth/me fails, login flow handles it
    }
    return Promise.reject(err);
  },
);

export default api;
