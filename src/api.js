const KC_URL = "https://id.tif.uin-suska.ac.id";
const BASE_URL = "https://api.tif.uin-suska.ac.id/setoran-dev/v1";

export async function login(username, password) {
  const response = await fetch(
    `${KC_URL}/realms/dev/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: "setoran-mobile-dev",
        client_secret: "aqJp3xnXKudgC7RMOshEQP7ZoVKWzoSl",
        grant_type: "password",
        username,
        password,
      }),
    }
  );

  return response.json();
}

export async function getSetoran(nim, token) {
  const response = await fetch(`${BASE_URL}/mahasiswa/setoran/${nim}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.json();
}

export const simpanSetoran = async (nim, token, data) => {
  const res = await fetch(`${BASE_URL}/mahasiswa/setoran/${nim}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return res.json();
};
export const deleteSetoran = async (nim, token, data) => {
  const res = await fetch(`${BASE_URL}/mahasiswa/setoran/${nim}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return res.json();
};

